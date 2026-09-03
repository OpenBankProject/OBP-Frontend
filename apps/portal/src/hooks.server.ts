import { createLogger } from '@obp/shared/utils';
const logger = createLogger('HooksServer');
import type { Handle } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { sveltekitSessionHandle } from 'svelte-kit-sessions';
import RedisStore from 'svelte-kit-connect-redis';
import { RetryAfterRateLimiter } from 'sveltekit-rate-limiter/server';

import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { obp_requests } from '$lib/obp/requests';
import { oauth2ProviderManager } from '$lib/oauth/providerManager';
import { SessionOAuthHelper } from '$lib/oauth/sessionHelper';
import { healthCheckRegistry, OIDCHealthCheckService, OpeyToolsHealthCheckService, ObpConsumerHealthCheckService } from '@obp/shared/health-check';
import { resolveGrpcTarget } from '@obp/shared/obp';

import { redisService } from '$lib/redis/services/RedisService';
import { RedisHealthCheckService, GrpcHealthCheckService } from '@obp/shared/server/health-check';
import {
	parseRateLimit,
	formatRate,
	checkClientAddress,
	warnIfClientAddressUnconfigured
} from '@obp/shared/server/rate-limit';

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
		serviceName: 'OBP API (REST)',
		url: `${publicEnv.PUBLIC_OBP_BASE_URL}/obp/v5.1.0/root`,
		details: {
			PUBLIC_OBP_BASE_URL: publicEnv.PUBLIC_OBP_BASE_URL
		}
	});

	// OBP-API's gRPC endpoint powers live streaming (chat). Same default host as
	// the gRPC clients in $lib/grpc, which read OBP_GRPC_HOST at call time.
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

		// Opey can be alive while its MCP tool layer is down — the chat then
		// answers everything with "my API tools are currently unavailable"
		// although the liveness check above stays green. This reads the mcp
		// component of Opey's /status JSON; on Opey builds that don't report
		// it yet, the check shows 'unknown' rather than a false green.
		healthCheckRegistry.register(
			new OpeyToolsHealthCheckService({
				serviceName: 'Opey (tools)',
				opeyBaseUrl: env.OPEY_BASE_URL,
				details: {
					OPEY_BASE_URL: env.OPEY_BASE_URL
				}
			})
		);
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

	// Register every known provider — including ones that failed to initialize —
	// so /status shows the full OIDC picture, not only the working providers.
	// The providerStatus callback reads live manager state, so a provider that
	// comes up (or dies) after boot flips on the status page without a restart.
	for (const p of oauth2ProviderManager.getAllProviders()) {
		const { clientId, clientSecret } = credentialsFor(p.provider);
		healthCheckRegistry.register(
			new OIDCHealthCheckService({
				serviceName: `OAuth2: ${p.provider}`,
				providerStatus: () => oauth2ProviderManager.getProviderStatus(p.provider),
				clientId,
				clientSecret,
				strictClientCredentials: testTokenStrict
			})
		);
		// Which OBP Consumer this app is, for this client: consumer_id and consumer_name from
		// GET /obp/v7.0.0/consumers/current/identity, shown on /status.
		if (clientId && clientSecret) {
			healthCheckRegistry.register(
				new ObpConsumerHealthCheckService({
					serviceName: `OBP consumer: ${p.provider}`,
					obpBaseUrl: publicEnv.PUBLIC_OBP_BASE_URL,
					providerStatus: () => oauth2ProviderManager.getProviderStatus(p.provider),
					clientId,
					clientSecret,
					...(env.API_MANAGER_URL
						? { consumerUrl: (id: string) => `${env.API_MANAGER_URL.replace(/\/$/, '')}/consumers/${encodeURIComponent(id)}` }
						: {})
				})
			);
		}
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
//
// Limits are keyed on client IP, so everyone behind one NAT (a hackathon
// room, an office) shares a bucket. Defaults are sized for a legitimate
// onboarding burst; override per deployment with RATE_LIMIT_* (see
// .env.example), e.g. RATE_LIMIT_REGISTER=50/15m for an event.
//
// NOTE: behind a reverse proxy adapter-node only sees the real client IP if
// ADDRESS_HEADER (and XFF_DEPTH) are set; otherwise every user shares the
// proxy's bucket.
const loginLimit = parseRateLimit('RATE_LIMIT_LOGIN', env.RATE_LIMIT_LOGIN, [30, 'm']);
const resetLimit = parseRateLimit('RATE_LIMIT_PASSWORD_RESET', env.RATE_LIMIT_PASSWORD_RESET, [10, '15m']);
const registerLimit = parseRateLimit('RATE_LIMIT_REGISTER', env.RATE_LIMIT_REGISTER, [20, '15m']);
logger.info(
	`Rate limits per IP: login ${formatRate(loginLimit)}, password reset ${formatRate(resetLimit)}, register ${formatRate(registerLimit)}`
);

const loginLimiter = new RetryAfterRateLimiter({ IP: loginLimit });
const resetLimiter = new RetryAfterRateLimiter({ IP: resetLimit });
const registerLimiter = new RetryAfterRateLimiter({ IP: registerLimit });
warnIfClientAddressUnconfigured();

// Shared-secret bypass for automated tests. Leave unset in production so the
// bypass path is physically unreachable there.
const RATE_LIMIT_BYPASS_TOKEN = env.RATE_LIMIT_BYPASS_TOKEN;

function tooManyRequests(retryAfter: number): Response {
	return new Response(
		JSON.stringify({ code: 429, message: 'OBP API Portal says: Too many requests, please try again later.' }),
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
	const isLimitedRoute =
		path === '/login' ||
		path === '/login/' ||
		path.startsWith('/forgot-password') ||
		path.startsWith('/reset-password') ||
		path === '/register' ||
		path.startsWith('/consumers/register');
	if (!isLimitedRoute) return resolve(event);

	// Warns (once) if the proxy header isn't being honoured; null means the
	// address can't be determined at all, in which case we log and let the
	// request through rather than 500 every login/registration.
	if (checkClientAddress(event) === null) return resolve(event);

	// Login is an OAuth redirect flow with no form action of its own, so a
	// limited POST here gets a bare 429 rather than a rendered page.
	if (path === '/login' || path === '/login/') {
		const status = await loginLimiter.check(event);
		if (status.limited) return tooManyRequests(status.retryAfter);
		return resolve(event);
	}

	// The remaining limited routes are plain (non-enhanced) HTML form POSTs.
	// Returning a raw 429 here would leave the browser showing a JSON blob, so
	// instead we flag the request on locals and let the action `fail(429, ...)`
	// with a message the page renders in its usual error box. The action checks
	// the flag before doing any work, so no upstream call is made.
	let formLimiter: RetryAfterRateLimiter | null = null;
	if (path.startsWith('/forgot-password') || path.startsWith('/reset-password')) {
		formLimiter = resetLimiter;
	} else if (path === '/register' || path.startsWith('/consumers/register')) {
		formLimiter = registerLimiter;
	}
	if (formLimiter) {
		const status = await formLimiter.check(event);
		if (status.limited) {
			logger.warn(
				`Rate limited POST ${path} from ${event.getClientAddress()} (retry after ${status.retryAfter}s)`
			);
			event.locals.rateLimit = { retryAfter: status.retryAfter };
		}
	}

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
		/**
		 * The Berlin Group consent authorisation this PSU is currently answering.
		 *
		 * Held across renders because starting one mints a new challenge and delivers a new OTP, so
		 * re-deriving it per render would invalidate the code the PSU is looking at.
		 */
		bgConsentAuthorisation?: {
			consentId: string;
			authorisationId: string;
		};
		/**
		 * The accounts the PSU ticked on the UK consent screen, bound to the challenge minted for
		 * that selection. Held here rather than round-tripped through the URL so the consent cannot
		 * be authorised for accounts that never appeared on the screen they consented from.
		 */
		ukConsentFlow?: {
			consentId: string;
			challengeId: string;
			accountIds: string[];
		};
	}
}
