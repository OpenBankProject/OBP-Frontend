/*
 * Copyright (C) 2025-2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import { createLogger } from '@obp/shared/utils';
const logger = createLogger("HooksServer");
import type { Handle } from "@sveltejs/kit";
import { error } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { sveltekitSessionHandle } from "svelte-kit-sessions";
import RedisStore from "svelte-kit-connect-redis";
import { RetryAfterRateLimiter } from "sveltekit-rate-limiter/server";
import { Redis } from "ioredis";
import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { oauth2ProviderManager } from "$lib/oauth/providerManager";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { resourceDocsCache } from "$lib/stores/resourceDocsCache";
import { healthCheckRegistry, OIDCHealthCheckService } from '@obp/shared/health-check';
import { resolveGrpcTarget } from '@obp/shared/obp';
import { RedisHealthCheckService, GrpcHealthCheckService } from '@obp/shared/server/health-check';
import {
  parseRateLimit,
  formatRate,
  checkClientAddress,
  warnIfClientAddressUnconfigured
} from '@obp/shared/server/rate-limit';
import { redisService } from '$lib/redis/services/RedisService';
// import { createOpeyNotebookDynamicEntityIfNeeded } from "$lib/server/opey/opeyNotebook"; // Opey notebook disabled, see below
import { createPortalPageDynamicEntityIfNeeded } from "$lib/server/portalPages/portalPageEntity";
import { createReportDynamicEntityIfNeeded } from "$lib/server/reports/reportEntity";
import { ensureSystemDynamicEntity } from "$lib/server/dynamicEntities/ensure";
import developerFaqEntity from "$lib/data/developerFaqEntity.json";
import { createOpeyConversationEntitiesIfNeeded } from "$lib/server/opeyConversations/opeyConversationEntity";

declare const process: { env: Record<string, string | undefined>; argv: string[] };

if (!publicEnv.PUBLIC_OBP_BASE_URL) {
  throw new Error(
    'PUBLIC_OBP_BASE_URL is not set. Configure it on the running container before starting api-manager.'
  );
}

// Constants
const DEFAULT_PORT = 3003;

// Check if server is running on non-default port
function checkServerPort() {
  // Check common port environment variables
  const envPort =
    process.env.PORT || process.env.VITE_PORT || process.env.SERVER_PORT;

  if (envPort && parseInt(envPort) !== DEFAULT_PORT) {
    logger.warn(
      `⚠️  WARNING: Server is configured to run on port ${envPort}, but the default port is ${DEFAULT_PORT}.`,
    );
    logger.warn(
      `   This may cause issues with OAuth callbacks and other integrations.`,
    );
    logger.warn(
      `   Consider using the default port or updating your configuration accordingly.`,
    );
  }

  // Check process arguments for --port flag
  const portArg = process.argv.find((arg: string) => arg.startsWith("--port="));
  if (portArg) {
    const argPort = parseInt(portArg.split("=")[1]);
    if (argPort !== DEFAULT_PORT) {
      logger.warn(
        `⚠️  WARNING: Server started with --port=${argPort}, but the default port is ${DEFAULT_PORT}.`,
      );
      logger.warn(
        `   This may cause issues with OAuth callbacks and other integrations.`,
      );
      logger.warn(
        `   Consider using the default port or updating your configuration accordingly.`,
      );
    }
  }
}

// Startup scripts
if (!env.SESSION_SECRET || typeof env.SESSION_SECRET !== 'string') {
  throw new Error(
    'SESSION_SECRET environment variable is required but not set (or not a string). ' +
      'Set it to a long random string in the runtime environment (e.g. in your .env file, ' +
      "docker-compose 'environment:' block, or 'docker run -e SESSION_SECRET=...'). " +
      'Note: this is a dynamic env var read at runtime — it must be present when the ' +
      'container starts, not only at build time. Without it, svelte-kit-sessions will ' +
      "crash later inside unsign() with 'Cannot read properties of undefined (reading map)'."
  );
}

// Check server port
checkServerPort();

// Init Redis
let client: Redis;
if (!env.REDIS_HOST || !env.REDIS_PORT) {
  logger.warn("Redis host or port is not set. Using defaults.");

  client = new Redis({
    host: "localhost",
    port: 6379,
  });
} else {
  logger.debug("Connecting to Redis at:", env.REDIS_HOST, env.REDIS_PORT);
  logger.debug("Redis password provided:", !!env.REDIS_PASSWORD);

  const redisConfig: any = {
    host: env.REDIS_HOST,
    port: parseInt(env.REDIS_PORT),
  };
  if (env.REDIS_PASSWORD) {
    redisConfig.password = env.REDIS_PASSWORD;
  }

  client = new Redis(redisConfig);
}

// Start OAuth2 provider manager (handles initialization and retries automatically)
await oauth2ProviderManager.start();

// Register and start health checks
healthCheckRegistry.register({
  serviceName: 'OBP API (REST)',
  url: `${publicEnv.PUBLIC_OBP_BASE_URL}/obp/v6.0.0/root`,
  details: {
    PUBLIC_OBP_BASE_URL: publicEnv.PUBLIC_OBP_BASE_URL
  }
});
// OBP-API's gRPC endpoint powers live streaming (metrics, log cache). Same
// default host as the gRPC clients in $lib/grpc, which read OBP_GRPC_HOST at
// call time.
const grpcTarget = resolveGrpcTarget({ ...env, ...publicEnv });
healthCheckRegistry.register(
  new GrpcHealthCheckService({
    serviceName: 'OBP API (gRPC)',
    host: grpcTarget.host,
    tls: grpcTarget.tls,
    details: {
      OBP_GRPC_HOST:
        env.OBP_GRPC_HOST ||
        `${grpcTarget.host} (default from PUBLIC_OBP_BASE_URL, env var unset)`,
      OBP_GRPC_TLS: env.OBP_GRPC_TLS || `${grpcTarget.tls} (default from port, env var unset)`
    }
  })
);
// Sessions are stored in Redis, so its health belongs on the status page too
healthCheckRegistry.register(new RedisHealthCheckService(redisService));
if (env.OPEY_BASE_URL) {
  // Server-side check: tests connectivity from the api-manager server to OPEY_BASE_URL
  // (private env). Does NOT prove the user's browser can reach Opey — see the
  // 'Opey (server)' / 'Opey (browser)' split on the /status page.
  healthCheckRegistry.register({
    serviceName: 'Opey (server)',
    url: `${env.OPEY_BASE_URL}/status`,
    details: {
      OPEY_BASE_URL: env.OPEY_BASE_URL,
      PUBLIC_OPEY_BASE_URL: publicEnv.PUBLIC_OPEY_BASE_URL || '(unset)'
    }
  });
}

const testTokenDisabled = env.OIDC_HEALTHCHECK_TEST_TOKEN === 'false';
const testTokenStrict = env.OIDC_HEALTHCHECK_TEST_TOKEN_STRICT === 'true';

const credentialsForProvider = (provider: string): { clientId?: string; clientSecret?: string } => {
  if (testTokenDisabled) return {};
  switch (provider) {
    case 'obp-oidc':
      return { clientId: env.OBP_OAUTH_CLIENT_ID, clientSecret: env.OBP_OAUTH_CLIENT_SECRET };
    case 'keycloak':
      return { clientId: env.KEYCLOAK_OAUTH_CLIENT_ID, clientSecret: env.KEYCLOAK_OAUTH_CLIENT_SECRET };
    default:
      return {};
  }
};

// Register every known provider — including ones that failed to initialize —
// so /status shows the full OIDC picture, not only the working providers.
// The providerStatus callback reads live manager state, so a provider that
// comes up (or dies) after boot flips on the status page without a restart.
for (const p of oauth2ProviderManager.getAllProviders()) {
  const { clientId, clientSecret } = credentialsForProvider(p.provider);
  healthCheckRegistry.register(
    new OIDCHealthCheckService({
      serviceName: `OAuth2: ${p.provider}`,
      providerStatus: () => oauth2ProviderManager.getProviderStatus(p.provider),
      clientId,
      clientSecret,
      strictClientCredentials: testTokenStrict,
      // Which OBP Consumer this client is (consumer_id, consumer_name), read with the test token
      // and shown in this row; the id links to the consumer's page here.
      obpBaseUrl: publicEnv.PUBLIC_OBP_BASE_URL,
      consumerUrl: (id: string) => `/consumers/${encodeURIComponent(id)}/edit`,
    })
  );
}

healthCheckRegistry.startAll();

// Bootstrap: the obp_portal_page system dynamic entity that App Studio saves pages and apps into.
// Needs the API Manager consumer to support client_credentials and hold CanCreateSystemLevelDynamicEntity.
createPortalPageDynamicEntityIfNeeded().then((ok: boolean) => {
  if (!ok) {
    logger.warn("obp_portal_page entity could not be created at startup; App Studio cannot save pages until it exists.");
  }
});
// Bootstrap: the public obp_developer_faq entity behind the Portal's /faq page.
ensureSystemDynamicEntity(developerFaqEntity).then((ok: boolean) => {
  if (!ok) logger.warn("obp_developer_faq entity could not be created at startup; the Portal FAQ stays empty until it exists.");
});

// Bootstrap: the obp_report system dynamic entity that the Reports page saves report definitions into.
createReportDynamicEntityIfNeeded().then((ok: boolean) => {
  if (!ok) {
    logger.warn("obp_report entity could not be created at startup; Reports cannot be saved until it exists.");
  }
});

// Bootstrap: the personal dynamic entities Opey conversations are recorded into (one row per chat,
// written as the User after each message), for this app and for the Portal, whose consumer
// normally lacks CanCreateSystemLevelDynamicEntity. Same consumer requirements as obp_portal_page.
void createOpeyConversationEntitiesIfNeeded();

// Opey notebook disabled 2026-09-03, together with the Opey Insights bar it fed (src/routes/+layout.svelte).
// The notebook was a system-level dynamic entity (opey_notebook) that Opey read and wrote per page so the
// top-of-page insights bar could summarise activity. The per-page Opey pane with explicit form access
// (dynamic resource docs, App Studio) replaced it. Code kept for reference: $lib/server/opey/opeyNotebook.ts,
// $lib/services/InsightService.ts, $lib/components/OpeyInsightBar.svelte. PUBLIC_OPEY_NOTEBOOK_ENABLED is no longer read.
//
// // Bootstrap: ensure opey_notebook dynamic entity exists (using application access)
// if (env.PUBLIC_OPEY_NOTEBOOK_ENABLED === 'true') {
//   createOpeyNotebookDynamicEntityIfNeeded().then((ok: boolean) => {
//     if (!ok) {
//       logger.warn(
//         "opey_notebook entity could not be created at startup. " +
//           "Ensure the API Manager consumer has the CanCreateSystemLevelDynamicEntity scope " +
//           "and supports the client_credentials grant. Opey notebook features will not work without it."
//       );
//     }
//   });
// } else {
//   logger.info("Opey notebook is disabled (PUBLIC_OPEY_NOTEBOOK_ENABLED != 'true').");
// }

function needsAuthorization(routeId: string): boolean {
  // protected routes are put in the /(protected)/ route group
  return routeId.startsWith("/(protected)/");
}

// Middleware to check user authorization
const checkAuthorization: Handle = async ({ event, resolve }) => {
  const session = event.locals.session;
  const routeId = event.route.id;

  if (!!routeId && needsAuthorization(routeId)) {
    logger.debug("Checking authorization for user route:", event.url.pathname);
    if (!oauth2ProviderManager.isReady()) {
      logger.warn("OAuth2 providers not ready");
      throw error(503, "Service Unavailable. Please try again later.");
    }
    // Check token expiration
    const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
    if (!sessionOAuth) {
      logger.warn(
        "No valid OAuth data found in session. Redirecting to login.",
      );
      // Redirect to login page if no OAuth data is found
      const redirectTo = encodeURIComponent(event.url.pathname + event.url.search);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/login?redirect_to=${redirectTo}`,
        },
      });
    }

    // Check if the access token is expired,
    // if it is, attempt to refresh it
    if (
      await sessionOAuth.client.checkAccessTokenExpiration(
        sessionOAuth.accessToken,
      )
    ) {
      // will return true if the token is expired
      try {
        await SessionOAuthHelper.refreshAccessToken(session);
      } catch (error) {
        logger.info(
          "Token refresh failed - redirecting user to login (normal OAuth behavior):",
          error,
        );
        // If the refresh fails, redirect to login
        // Destroy the session
        logger.info("Destroying expired session and redirecting to login.");
        await session.destroy();

        const redirectTo = encodeURIComponent(event.url.pathname + event.url.search);
        return new Response(null, {
          status: 302,
          headers: {
            Location: `/login?redirect_to=${redirectTo}`,
          },
        });
      }
    }

    if (!session || !session.data.user) {
      // Redirect to login page if not authenticated
      const redirectTo = encodeURIComponent(event.url.pathname + event.url.search);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/login?redirect_to=${redirectTo}`,
        },
      });
    } else {
      logger.debug("User is authenticated:", session.data.user?.email);

      // Pre-warm resource docs cache in background (non-blocking)
      const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
      if (sessionOAuth?.accessToken) {
        resourceDocsCache.preWarmCache(sessionOAuth.accessToken).catch(() => {
          // Silently fail - pre-warming is best-effort
        });
      }
    }
  }

  const response = await resolve(event);
  return response;
};

// Rate limiters for sensitive routes. In-memory store: resets on restart,
// not shared across nodes. Migrate to Redis-backed for horizontal scaling.
//
// Limits are keyed on client IP, so everyone behind one NAT (a hackathon
// room, an office) shares a bucket. Override per deployment with
// RATE_LIMIT_* (see .env.example). Behind a reverse proxy adapter-node only
// sees the real client IP if ADDRESS_HEADER (and XFF_DEPTH) are set.
const loginLimit = parseRateLimit('RATE_LIMIT_LOGIN', env.RATE_LIMIT_LOGIN, [30, 'm']);
const opeyLimit = parseRateLimit('RATE_LIMIT_OPEY', env.RATE_LIMIT_OPEY, [30, 'm']);
logger.info(`Rate limits per IP: login ${formatRate(loginLimit)}, opey ${formatRate(opeyLimit)}`);

const loginLimiter = new RetryAfterRateLimiter({ IP: loginLimit });
const opeyLimiter = new RetryAfterRateLimiter({ IP: opeyLimit });
warnIfClientAddressUnconfigured();

// Shared-secret bypass for automated tests. Leave unset in production so the
// bypass path is physically unreachable there.
const RATE_LIMIT_BYPASS_TOKEN = env.RATE_LIMIT_BYPASS_TOKEN;

function tooManyRequests(retryAfter: number): Response {
  return new Response(
    JSON.stringify({ code: 429, message: 'OBP API Manager says: Too many requests, please try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.max(1, Math.ceil(retryAfter)))
      }
    }
  );
}

const rateLimit: Handle = async ({ event, resolve }) => {
  if (
    RATE_LIMIT_BYPASS_TOKEN &&
    event.request.headers.get('rate-limit-bypass-token') === RATE_LIMIT_BYPASS_TOKEN
  ) {
    return resolve(event);
  }

  if (event.request.method !== 'POST') return resolve(event);

  const path = event.url.pathname;

  let limiter: RetryAfterRateLimiter | null = null;
  if (path === '/login' || path === '/login/') {
    limiter = loginLimiter;
  } else if (path.startsWith('/backend/opey/')) {
    limiter = opeyLimiter;
  }
  // Warns (once) if the proxy header isn't being honoured; null means the
  // address can't be determined at all, in which case we log and let the
  // request through rather than 500 every login.
  if (limiter && checkClientAddress(event) !== null) {
    const status = await limiter.check(event);
    if (status.limited) {
      logger.warn(
        `Rate limited POST ${path} from ${event.getClientAddress()} (retry after ${status.retryAfter}s)`
      );
      return tooManyRequests(status.retryAfter);
    }
  }

  return resolve(event);
};

// Init SvelteKitSessions
export const handle: Handle = sequence(
  rateLimit,
  sveltekitSessionHandle({
    secret: env.SESSION_SECRET,
    name: "obp-api-manager-ii-connect.sid",
    cookie: { httpOnly: true, secure: true, sameSite: "lax" },
    store: new RedisStore({
      client,
      prefix: "obp-api-manager-ii-session:",
    }),
  }),
  checkAuthorization,
  // add other handles here if needed
);

// Declare types for the Session
declare module "svelte-kit-sessions" {
  interface SessionData {
    user?: {
      user_id: string;
      email: string;
      username: string;
    };
    oauth?: {
      access_token: string;
      refresh_token?: string;
      provider: string;
    };
    authInfo?: {
      authenticated: boolean;
    };
    /** Epoch ms of the last /users/current fetch (set at login and by the layout's silent refresh) */
    userRefreshedAt?: number;
  }
}
