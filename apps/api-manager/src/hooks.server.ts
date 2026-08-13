import { createLogger } from '@obp/shared/utils';
const logger = createLogger("HooksServer");
import type { Handle } from "@sveltejs/kit";
import { error } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { sveltekitSessionHandle } from "svelte-kit-sessions";
import RedisStore from "svelte-kit-connect-redis";
import { RateLimiter } from "sveltekit-rate-limiter/server";
import { Redis } from "ioredis";
import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { oauth2ProviderManager } from "$lib/oauth/providerManager";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { resourceDocsCache } from "$lib/stores/resourceDocsCache";
import { healthCheckRegistry, OIDCHealthCheckService } from '@obp/shared/health-check';
import { resolveGrpcHost } from '@obp/shared/obp';
import { RedisHealthCheckService, GrpcHealthCheckService } from '@obp/shared/server/health-check';
import { redisService } from '$lib/redis/services/RedisService';
import { createOpeyNotebookDynamicEntityIfNeeded } from "$lib/server/opey/opeyNotebook";

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
const grpcHost = resolveGrpcHost({ ...env, ...publicEnv });
healthCheckRegistry.register(
  new GrpcHealthCheckService({
    serviceName: 'OBP API (gRPC)',
    host: grpcHost,
    details: {
      OBP_GRPC_HOST:
        env.OBP_GRPC_HOST || `${grpcHost} (default from PUBLIC_OBP_BASE_URL, env var unset)`
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
    })
  );
}

healthCheckRegistry.startAll();

// Bootstrap: ensure opey_notebook dynamic entity exists (using application access)
if (env.PUBLIC_OPEY_NOTEBOOK_ENABLED === 'true') {
  createOpeyNotebookDynamicEntityIfNeeded().then((ok: boolean) => {
    if (!ok) {
      logger.warn(
        "opey_notebook entity could not be created at startup. " +
          "Ensure the API Manager consumer has the CanCreateSystemLevelDynamicEntity scope " +
          "and supports the client_credentials grant. Opey notebook features will not work without it."
      );
    }
  });
} else {
  logger.info("Opey notebook is disabled (PUBLIC_OPEY_NOTEBOOK_ENABLED != 'true').");
}

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
const loginLimiter = new RateLimiter({ IP: [10, 'm'] });
const opeyLimiter = new RateLimiter({ IP: [30, 'm'] });

// Shared-secret bypass for automated tests. Leave unset in production so the
// bypass path is physically unreachable there.
const RATE_LIMIT_BYPASS_TOKEN = env.RATE_LIMIT_BYPASS_TOKEN;

function tooManyRequests(): Response {
  return new Response(
    JSON.stringify({ code: 429, message: 'OBP API Manager says: Too many requests, please try again later.' }),
    { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
  );
}

const rateLimit: Handle = async ({ event, resolve }) => {
  if (
    RATE_LIMIT_BYPASS_TOKEN &&
    event.request.headers.get('rate-limit-bypass-token') === RATE_LIMIT_BYPASS_TOKEN
  ) {
    return resolve(event);
  }

  const path = event.url.pathname;

  if (
    (path === '/login' || path === '/login/') &&
    event.request.method === 'POST' &&
    (await loginLimiter.isLimited(event))
  ) return tooManyRequests();
  if (
    path.startsWith('/backend/opey/') &&
    event.request.method === 'POST' &&
    (await opeyLimiter.isLimited(event))
  ) return tooManyRequests();

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
