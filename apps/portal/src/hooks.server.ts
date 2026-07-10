import { createLogger } from '@obp/shared/utils';
const logger = createLogger('HooksServer');
import type { Handle } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { sveltekitSessionHandle } from 'svelte-kit-sessions';
import RedisStore from 'svelte-kit-connect-redis';
import { RateLimiter } from 'sveltekit-rate-limiter/server';

import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { obp_requests } from '$lib/obp/requests';
import { oauth2ProviderManager } from '$lib/oauth/providerManager';
import { SessionOAuthHelper } from '$lib/oauth/sessionHelper';
import { healthCheckRegistry, OIDCHealthCheckService } from '@obp/shared/health-check';

import { redisService } from '$lib/redis/services/RedisService';
import { RedisHealthCheckService } from '@obp/shared/server/health-check';

if (!publicEnv.PUBLIC_OBP_BASE_URL) {
	throw new Error(
		'PUBLIC_OBP_BASE_URL is not set. Configure it on the running container before starting the portal.'
	);
}

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
const redisClient = redisService.getClient();

function initHealthChecks() {
	healthCheckRegistry.register({
		serviceName: 'OBP API',
		url: `${publicEnv.PUBLIC_OBP_BASE_URL}/obp/v5.1.0/root`,
		details: {
			PUBLIC_OBP_BASE_URL: publicEnv.PUBLIC_OBP_BASE_URL
		}
	});

	// Server-side check: tests connectivity from the portal server to OPEY_BASE_URL
	// (private env, usually an internal/private network address). This does NOT prove
	// the user's browser can reach Opey — the browser uses PUBLIC_OPEY_BASE_URL,
	// which is verified by a separate browser-side check on the /status page.
	if (env.OPEY_BASE_URL) {
		healthCheckRegistry.register({
			serviceName: 'Opey (server)',
			url: `${env.OPEY_BASE_URL}/status`,
			details: {
				OPEY_BASE_URL: env.OPEY_BASE_URL
			}
		});
	}

	const redisHealthCheck = new RedisHealthCheckService(redisService);
	healthCheckRegistry.register(redisHealthCheck);

	const testTokenDisabled = env.OIDC_HEALTHCHECK_TEST_TOKEN === 'false';
	const testTokenStrict = env.OIDC_HEALTHCHECK_TEST_TOKEN_STRICT === 'true';

	const credentialsFor = (provider: string): { clientId?: string; clientSecret?: string } => {
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

	const availableProviders = oauth2ProviderManager.getAvailableProviders();
	for (const p of availableProviders) {
		if (!p.url) continue;
		const { clientId, clientSecret } = credentialsFor(p.provider);
		healthCheckRegistry.register(
			new OIDCHealthCheckService({
				serviceName: `OAuth2: ${p.provider}`,
				wellKnownUrl: p.url,
				clientId,
				clientSecret,
				strictClientCredentials: testTokenStrict
			})
		);
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

	// No user in session — log for backend/proxy routes to help trace auth issues
	if (routePath.startsWith('/backend/') || routePath.startsWith('/proxy/')) {
		logger.debug(`No session user for backend request: ${routePath} (session ID: ${session?.id || 'none'})`);
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

// Routes that carry a single-use secret token in the URL path — analytics must not
// see these paths (gtag reports page_location, which would exfiltrate the token).
const TOKEN_IN_URL_ROUTE_PREFIXES = ['/reset-password/', '/user_mgt/reset_password/'];

function pathCarriesUrlToken(pathname: string): boolean {
	return TOKEN_IN_URL_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

const transformHTML: Handle = async ({ event, resolve }) => {
	const skipAnalytics = pathCarriesUrlToken(event.url.pathname);
	const analyticsScript = env.ENABLE_ANALYTICS === "true" && env.GTAG_ID && !skipAnalytics
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

	// strict-origin-when-cross-origin drops the path/query on cross-origin requests
	// (e.g. outbound links, third-party scripts), preventing URL-embedded tokens from
	// leaking via the Referer header.
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	return response;
}

// Rate limiters for sensitive routes. In-memory store: resets on restart,
// not shared across nodes. Migrate to Redis-backed for horizontal scaling.
// See sveltekit-rate-limiter docs for RedisStore adapter.
const loginLimiter = new RateLimiter({ IP: [10, 'm'] });
const resetLimiter = new RateLimiter({ IP: [5, '15m'] });
const registerLimiter = new RateLimiter({ IP: [3, '15m'] });

// Shared-secret bypass for automated tests. Leave unset in production so the
// bypass path is physically unreachable there.
const RATE_LIMIT_BYPASS_TOKEN = env.RATE_LIMIT_BYPASS_TOKEN;

function tooManyRequests(): Response {
	return new Response(
		JSON.stringify({ code: 429, message: 'OBP API Portal says: Too many requests, please try again later.' }),
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
		(path.startsWith('/forgot-password') || path.startsWith('/reset-password')) &&
		event.request.method === 'POST' &&
		(await resetLimiter.isLimited(event))
	) return tooManyRequests();
	if (
		(path === '/register' || path.startsWith('/consumers/register')) &&
		event.request.method === 'POST' &&
		(await registerLimiter.isLimited(event))
	) return tooManyRequests();

	return resolve(event);
};

// Init SvelteKitSessions
export const handle: Handle = sequence(
	rateLimit,
	sveltekitSessionHandle({
		name: 'obp-portal-connect.sid',
		secret: env.SESSION_SECRET,
		cookie: { httpOnly: true, secure: true, sameSite: 'lax' },
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
		obpConsentFlow?: {
			oidcReturnUrl: string;
			consentRequestId: string;
			bankId: string;
		};
	}
}
