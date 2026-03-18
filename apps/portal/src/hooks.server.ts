import { createLogger } from '$lib/utils/logger';
const logger = createLogger('HooksServer');
import type { Handle } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { sveltekitSessionHandle } from 'svelte-kit-sessions';
import RedisStore from 'svelte-kit-connect-redis';

import { env } from '$env/dynamic/private';
import { obp_requests } from '$lib/obp/requests';
import { oauth2ProviderManager } from '$lib/oauth/providerManager';
import { SessionOAuthHelper } from '$lib/oauth/sessionHelper';
import { healthCheckRegistry } from '$lib/health-check/HealthCheckRegistry';
import { PUBLIC_OBP_BASE_URL } from '$env/static/public';

import { redisService } from '$lib/redis/services/RedisService';
import { RedisHealthCheckService } from '$lib/health-check/services/RedisHealthCheckService';

// Constants
const DEFAULT_PORT = 5174;

// Check if server is running on non-default port
function checkServerPort() {
	// Check common port environment variables
	const envPort = process.env.PORT || process.env.VITE_PORT || process.env.SERVER_PORT;

	if (envPort && parseInt(envPort) !== DEFAULT_PORT) {
		logger.warn(
			`⚠️  WARNING: Server is configured to run on port ${envPort}, but the default port is ${DEFAULT_PORT}.`
		);
		logger.warn(`   This may cause issues with OAuth callbacks and other integrations.`);
		logger.warn(`   Consider using the default port or updating your configuration accordingly.`);
	}

	// Check process arguments for --port flag
	const portArg = process.argv.find((arg) => arg.startsWith('--port='));
	if (portArg) {
		const argPort = parseInt(portArg.split('=')[1]);
		if (argPort !== DEFAULT_PORT) {
			logger.warn(
				`⚠️  WARNING: Server started with --port=${argPort}, but the default port is ${DEFAULT_PORT}.`
			);
			logger.warn(`   This may cause issues with OAuth callbacks and other integrations.`);
			logger.warn(`   Consider using the default port or updating your configuration accordingly.`);
		}
	}
}

// Startup scripts
// Check server port
checkServerPort();

// Init Redis
const redisClient = redisService.getClient();

function initHealthChecks() {
	healthCheckRegistry.register({
		serviceName: 'OBP API',
		url: `${PUBLIC_OBP_BASE_URL}/obp/v5.1.0/root`
	});

	healthCheckRegistry.register({
		serviceName: 'Opey II',
		url: `${env.OPEY_BASE_URL}/status`
	});

	const redisHealthCheck = new RedisHealthCheckService();
	healthCheckRegistry.register(redisHealthCheck);

	const oauthHealthChecks = oauth2ProviderManager.getHealthCheckEntries();
	for (const check of oauthHealthChecks) {
		healthCheckRegistry.register(check);
	}

	healthCheckRegistry.startAll();
}

await oauth2ProviderManager.start();

initHealthChecks();

async function initWebUIProps() {
	try {
		const webuiProps = await obp_requests.get('/obp/v5.1.0/webui-props');
		logger.info('WebUI props fetched successfully:', webuiProps);
		return webuiProps;
	} catch (error) {
		logger.error('Failed to fetch WebUI props:', error);
		throw error;
	}
}

function needsAuthorization(routeId: string): boolean {
	// protected routes are put in the /(protected)/ route group
	return routeId.startsWith('/(protected)/');
}

const checkSessionValidity: Handle = async ({ event, resolve }) => {
	const session = event.locals.session;
	const routePath = event.url.pathname;

	if (session.data.user) {
		const username = session.data.user.username || session.data.user.email;
		const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
		if (!sessionOAuth) {
			logger.warn(`Session for ${username} (${session.id}) has no valid OAuth data on ${routePath}. Destroying session.`);
			await session.destroy();

			// Redirect to trigger a fresh load instead of just resolving
			throw redirect(302, event.url.pathname);
		}

		const sessionExpired = await sessionOAuth.client.checkAccessTokenExpiration(
			sessionOAuth.accessToken
		);
		// Check if the access token is expired,
		// if it is, attempt to refresh it
		if (sessionExpired) {
			logger.info(`Access token expired for ${username} (${session.id}) on ${routePath}. Attempting refresh...`);
			// will return true if the token is expired
			try {
				await SessionOAuthHelper.refreshAccessToken(session);
				logger.info(`Token refreshed successfully for ${username} (${session.id})`);
				return await resolve(event);
			} catch (error) {
				logger.info(
					`Token refresh failed for ${username} (${session.id}) on ${routePath}:`,
					error
				);
				// If the refresh fails, redirect to login
				// Destroy the session
				logger.info(`Destroying expired session for ${username} (${session.id})`);
				await session.destroy();
				// Redirect to trigger a fresh load and clear client-side cache
				throw redirect(302, event.url.pathname);
			}
		}

		// If we reach here, the session is valid (either not expired or successfully refreshed)
		logger.debug(`Session valid for ${username} (${session.id}) on ${routePath}`);
		return await resolve(event);
	}

	// No user in session — log for API routes to help trace auth issues
	if (routePath.startsWith('/api/')) {
		logger.debug(`No session user for API request: ${routePath} (session ID: ${session?.id || 'none'})`);
	}

	// Always return a response, even when there's no session
	return await resolve(event);
};

// Middleware to check user authorization
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
			// Redirect to login page if not authenticated
			return new Response(null, {
				status: 302,
				headers: {
					Location: '/login'
				}
			});
		} else {
			logger.debug('User is authenticated:', session.data.user);
			// Optionally, you can add more checks here, e.g., user roles or permissions
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
	// add other handles here if needed
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
