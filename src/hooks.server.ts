import { createLogger } from "$lib/utils/logger";
const logger = createLogger("HooksServer");
import type { Handle } from "@sveltejs/kit";
import { error } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { sveltekitSessionHandle } from "svelte-kit-sessions";
import RedisStore from "svelte-kit-connect-redis";
import { Redis } from "ioredis";
import { env } from "$env/dynamic/private";
import { PUBLIC_OBP_BASE_URL } from "$env/static/public";
import { oauth2ProviderManager } from "$lib/oauth/providerManager";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { resourceDocsCache } from "$lib/stores/resourceDocsCache";
import { healthCheckRegistry } from "$lib/health-check/HealthCheckRegistry";
import { ensureOpeyNotebook } from "$lib/server/opey/opeyNotebook";

declare const process: { env: Record<string, string | undefined>; argv: string[] };

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
healthCheckRegistry.register({ serviceName: 'OBP API', url: `${PUBLIC_OBP_BASE_URL}/obp/v6.0.0/root` });
if (env.OPEY_BASE_URL) {
  healthCheckRegistry.register({ serviceName: 'Opey II', url: `${env.OPEY_BASE_URL}/status` });
}
healthCheckRegistry.startAll();

// Bootstrap: ensure opey_notebook dynamic entity exists (using application access)
ensureOpeyNotebook().then((ok) => {
  if (!ok) {
    logger.warn(
      "opey_notebook entity could not be created at startup. " +
        "Ensure the API Manager consumer has the CanCreateSystemLevelDynamicEntity scope " +
        "and supports the client_credentials grant. Opey notebook features will not work without it."
    );
  }
});

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

// Init SvelteKitSessions
export const handle: Handle = sequence(
  sveltekitSessionHandle({
    secret: "secret",
    name: "obp-api-manager-ii-connect.sid",
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
  }
}
