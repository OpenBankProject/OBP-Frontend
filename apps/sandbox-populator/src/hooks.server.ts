// Keep every log line for GET /monitoring/log-cache, including those written while the other modules load.
import '@obp/shared/server/monitoring/capture';
import { createLogger } from '$lib/utils/logger';
const logger = createLogger('HooksServer');
import type { Handle } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { sveltekitSessionHandle } from 'svelte-kit-sessions';
import { env } from '$env/dynamic/private';
import { building, dev } from '$app/environment';
import { env as publicEnv } from '$env/dynamic/public';
import { requestTelemetry, startTelemetry } from '@obp/shared/server/monitoring';
import { healthCheckRegistry, OIDCHealthCheckService } from '@obp/shared/health-check';
import { RedisHealthCheckService } from '@obp/shared/server/health-check';
import RedisStore from 'svelte-kit-connect-redis';

import { oauth2ProviderManager } from '$lib/oauth/providerManager';
import { SessionOAuthHelper } from '$lib/oauth/sessionHelper';
import { redisService } from '$lib/redis/services/RedisService';

// Constants
const DEFAULT_PORT = 5178;

// Check if server is running on non-default port
function checkServerPort() {
	const envPort = process.env.PORT || process.env.VITE_PORT || process.env.SERVER_PORT;

	if (envPort && parseInt(envPort) !== DEFAULT_PORT) {
		logger.warn(
			`Server is configured to run on port ${envPort}, but the default port is ${DEFAULT_PORT}.`
		);
		logger.warn(`This may cause issues with OAuth callbacks and other integrations.`);
	}
}

// Startup scripts
checkServerPort();

// The secret that signs the session cookie. Anyone who knows it can forge a session, so outside
// development it must come from SESSION_SECRET. In development a fixed, insecure default keeps
// `npm run dev` working without extra setup.
function resolveSessionSecret(): string {
	const secret = env.SESSION_SECRET;
	if (secret && secret.length >= 16) return secret;
	if (!dev && !building) {
		throw new Error(
			'SESSION_SECRET must be set (at least 16 characters) in production. ' +
				'Generate one with: openssl rand -hex 32'
		);
	}
	logger.warn('SESSION_SECRET is not set (or too short). Using an insecure development default.');
	return 'sandbox-populator-insecure-dev-session-secret';
}

// Telemetry for GET /monitoring/telemetry: this app's requests and its calls to OBP-API.
startTelemetry('sandbox-populator', publicEnv.PUBLIC_OBP_BASE_URL);

// Init Redis
const redisClient = redisService.getClient();

await oauth2ProviderManager.start();

// What /status shows: whether OBP-API, Redis (where sessions are kept) and each OAuth2 provider answer.
// Every known provider is registered, including one that failed to start, and its status is read live.
healthCheckRegistry.register({
	serviceName: 'OBP API (REST)',
	url: `${publicEnv.PUBLIC_OBP_BASE_URL}/obp/v5.1.0/root`,
	details: { PUBLIC_OBP_BASE_URL: publicEnv.PUBLIC_OBP_BASE_URL ?? '(unset)' }
});
healthCheckRegistry.register(new RedisHealthCheckService(redisService));
for (const p of oauth2ProviderManager.getAllProviders()) {
	healthCheckRegistry.register(
		new OIDCHealthCheckService({
			serviceName: `OAuth2: ${p.provider}`,
			providerStatus: () =>
				oauth2ProviderManager.getAllProviders().find((status) => status.provider === p.provider)
		})
	);
}
healthCheckRegistry.startAll();

function needsAuthorization(routeId: string): boolean {
	// protected routes are put in the /(protected)/ route group
	return routeId.startsWith('/(protected)/');
}

const checkSessionValidity: Handle = async ({ event, resolve }) => {
	const session = event.locals.session;
	if (session.data.user) {
		const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
		if (!sessionOAuth) {
			logger.warn('No valid OAuth data found in session. Destroying session.');
			await session.destroy();
			throw redirect(302, event.url.pathname);
		}

		const sessionExpired = await sessionOAuth.client.checkAccessTokenExpiration(
			sessionOAuth.accessToken
		);

		if (sessionExpired) {
			try {
				await SessionOAuthHelper.refreshAccessToken(session);
				return await resolve(event);
			} catch (error) {
				logger.info(
					'Token refresh failed - redirecting user to login (normal OAuth behavior):',
					error
				);
				logger.info('Destroying expired session.');
				await session.destroy();
				throw redirect(302, event.url.pathname);
			}
		}

		logger.debug('Session is valid for user:', session.data.user?.username);
		return await resolve(event);
	}

	return await resolve(event);
};

// Middleware to check user authorization
const checkAuthorization: Handle = async ({ event, resolve }) => {
	const session = event.locals.session;
	const routeId = event.route.id;

	if (!!routeId && needsAuthorization(routeId)) {
		logger.debug('Checking authorization for user route:', event.url.pathname);

		if (!session || !session.data.user) {
			// Only block unauthenticated users if OAuth providers are unavailable
			if (!oauth2ProviderManager.isReady()) {
				logger.warn('OAuth2 providers not ready and user is not authenticated');
				throw error(503, 'Service Unavailable. OAuth providers are not ready. Please try again later.');
			}
			return new Response(null, {
				status: 302,
				headers: { Location: '/login' }
			});
		} else {
			logger.debug('User is authenticated:', session.data.user);
		}
	}

	const response = await resolve(event);
	return response;
};

// Init SvelteKitSessions
export const handle: Handle = sequence(
	requestTelemetry,
	sveltekitSessionHandle({
		name: 'sandbox-populator-connect.sid',
		secret: resolveSessionSecret(),
		store: new RedisStore({
			client: redisClient,
			prefix: 'sandbox-populator-session:'
		})
	}),
	checkSessionValidity,
	checkAuthorization
);

// Declare types for the Session
declare module 'svelte-kit-sessions' {
	interface SessionData {
		user?: {
			user_id: string;
			email: string;
			username: string;
			entitlements: {
				list: Array<{
					entitlement_id: string;
					role_name: string;
					bank_id: string;
				}>;
			};
			views: {
				list: object[];
			};
		};
		oauth?: {
			access_token: string;
			refresh_token?: string;
			provider: string;
		};
		sandbox_populator_last_bank_id_prefix?: string;
	}
}
