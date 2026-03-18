import { createLogger } from '$lib/utils/logger';
const logger = createLogger('HooksServer');
import type { Handle } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { sveltekitSessionHandle } from 'svelte-kit-sessions';
import RedisStore from 'svelte-kit-connect-redis';

import { env } from '$env/dynamic/private';
import { createOBPRequests } from '$lib/obp/requests';
import { OAuth2ProviderManager } from '$lib/server/oauth/providerManager';
import { OAuth2ProviderFactory, OBPOIDCStrategy } from '$lib/server/oauth/providerFactory';
import { SessionOAuthHelper } from '$lib/server/oauth/sessionHelper';
import { HealthCheckRegistry } from '$lib/health-check/HealthCheckRegistry';
import { PUBLIC_OBP_BASE_URL } from '$env/static/public';

import { RedisService } from '$lib/server/redis/RedisService';
import { RedisHealthCheckService } from '$lib/server/health-check/RedisHealthCheckService';

// Constants
const DEFAULT_PORT = 5174;

// Check if server is running on non-default port
function checkServerPort() {
	const envPort = process.env.PORT || process.env.VITE_PORT || process.env.SERVER_PORT;

	if (envPort && parseInt(envPort) !== DEFAULT_PORT) {
		logger.warn(
			`⚠️  WARNING: Server is configured to run on port ${envPort}, but the default port is ${DEFAULT_PORT}.`
		);
		logger.warn(`   This may cause issues with OAuth callbacks and other integrations.`);
	}
}

// Startup scripts
checkServerPort();

// Init Redis
const redisService = new RedisService({
	host: env.REDIS_HOST || 'localhost',
	port: parseInt(env.REDIS_PORT || '6379'),
	password: env.REDIS_PASSWORD || undefined
});
const redisClient = redisService.getClient();

// Init OAuth2 provider factory with OBP-OIDC strategy
const oauth2ProviderFactory = new OAuth2ProviderFactory([
	new OBPOIDCStrategy({
		clientId: env.OBP_OAUTH_CLIENT_ID || '',
		clientSecret: env.OBP_OAUTH_CLIENT_SECRET || '',
		callbackUrl: env.APP_CALLBACK_URL || `http://localhost:${DEFAULT_PORT}/login/obp/callback`
	})
]);

// Init OAuth2 provider manager
const obpRequests = createOBPRequests(PUBLIC_OBP_BASE_URL);
const oauth2ProviderManager = new OAuth2ProviderManager(oauth2ProviderFactory, obpRequests);

// Init session OAuth helper
const sessionOAuthHelper = new SessionOAuthHelper(oauth2ProviderFactory);

// Export singletons for use in route handlers
export { oauth2ProviderFactory, oauth2ProviderManager, sessionOAuthHelper, obpRequests, healthCheckRegistry };

const healthCheckRegistry = new HealthCheckRegistry();

function initHealthChecks() {
	healthCheckRegistry.register({
		serviceName: 'OBP API',
		url: `${PUBLIC_OBP_BASE_URL}/obp/v5.1.0/root`
	});

	if (env.OPEY_BASE_URL) {
		healthCheckRegistry.register({
			serviceName: 'Opey II',
			url: `${env.OPEY_BASE_URL}/status`
		});
	}

	const redisHealthCheck = new RedisHealthCheckService(redisService);
	healthCheckRegistry.register(redisHealthCheck);

	const oauthHealthChecks = oauth2ProviderManager.getHealthCheckEntries();
	for (const check of oauthHealthChecks) {
		healthCheckRegistry.register(check);
	}

	healthCheckRegistry.startAll();
}

await oauth2ProviderManager.start();

initHealthChecks();

function needsAuthorization(routeId: string): boolean {
	return routeId.startsWith('/(protected)/');
}

const checkSessionValidity: Handle = async ({ event, resolve }) => {
	const session = event.locals.session;
	const routePath = event.url.pathname;

	if (session.data.user) {
		const username = session.data.user.username || session.data.user.email;
		const sessionOAuth = sessionOAuthHelper.getSessionOAuth(session);
		if (!sessionOAuth) {
			logger.warn(`Session for ${username} (${session.id}) has no valid OAuth data on ${routePath}. Destroying session.`);
			await session.destroy();
			throw redirect(302, event.url.pathname);
		}

		const sessionExpired = await sessionOAuth.client.checkAccessTokenExpiration(
			sessionOAuth.accessToken
		);
		if (sessionExpired) {
			logger.info(`Access token expired for ${username} (${session.id}) on ${routePath}. Attempting refresh...`);
			try {
				await sessionOAuthHelper.refreshAccessToken(session);
				logger.info(`Token refreshed successfully for ${username} (${session.id})`);
				return await resolve(event);
			} catch (error) {
				logger.info(
					`Token refresh failed for ${username} (${session.id}) on ${routePath}:`,
					error
				);
				logger.info(`Destroying expired session for ${username} (${session.id})`);
				await session.destroy();
				throw redirect(302, event.url.pathname);
			}
		}

		logger.debug(`Session valid for ${username} (${session.id}) on ${routePath}`);
		return await resolve(event);
	}

	if (routePath.startsWith('/api/')) {
		logger.debug(`No session user for API request: ${routePath} (session ID: ${session?.id || 'none'})`);
	}

	return await resolve(event);
};

const checkAuthorization: Handle = async ({ event, resolve }) => {
	const session = event.locals.session;
	const routeId = event.route.id;

	if (!!routeId && needsAuthorization(routeId)) {
		logger.debug('Checking authorization for user route:', event.url.pathname);
		if (!oauth2ProviderManager.isReady()) {
			logger.warn('OAuth2 providers not ready');
			throw error(503, 'Service Unavailable. Please try again later.');
		}

		if (!session || !session.data.user) {
			return new Response(null, {
				status: 302,
				headers: {
					Location: '/login'
				}
			});
		} else {
			logger.debug('User is authenticated:', session.data.user);
		}
	}

	const response = await resolve(event);
	return response;
};

const transformHTML: Handle = async ({ event, resolve }) => {
	const analyticsScript = env.ENABLE_ANALYTICS === "true" && env.GTAG_ID
		? `<script async src="https://www.googletagmanager.com/gtag/js?id=${env.GTAG_ID}"></script>
	<script>
		window.dataLayer = window.dataLayer || [];
		function gtag() { dataLayer.push(arguments); }
		gtag('js', new Date());
		gtag('config', '${env.GTAG_ID}');
	</script>`
		: '';

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => {
			return html.replace('%ANALYTICS_SCRIPT%', analyticsScript);
		}
	});
	return response;
}

// Init SvelteKitSessions
export const handle: Handle = sequence(
	sveltekitSessionHandle({
		name: 'obp-portal-connect.sid',
		secret: 'secret',
		store: new RedisStore({
			client: redisClient,
			prefix: 'obp-portal-session:'
		})
	}),
	checkSessionValidity,
	checkAuthorization,
	transformHTML
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
	}
}
