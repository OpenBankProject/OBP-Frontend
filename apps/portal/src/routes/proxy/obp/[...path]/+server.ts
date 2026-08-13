import type { RequestHandler } from './$types';
import { createLogger } from '@obp/shared/utils';
import { env } from '$env/dynamic/public';

const logger = createLogger('OBPProxy');

// hooks.server.ts refuses to start without PUBLIC_OBP_BASE_URL, so no fallback here.
const OBP_BASE_URL = env.PUBLIC_OBP_BASE_URL;
const TIMEOUT_MS = 15_000;

/**
 * Generic authenticated proxy to the OBP-API.
 *
 * Forwards the request to the OBP-API with the user's OAuth token.
 * The OBP path is taken from the URL: /proxy/obp/v6.0.0/foo → GET /obp/v6.0.0/foo
 *
 * Supports GET, POST, PUT, DELETE, PATCH.
 * Responses are passed through unmodified (same status, same JSON body).
 */
async function proxyRequest(event: Parameters<RequestHandler>[0]): Promise<Response> {
	const session = event.locals.session;
	if (!session?.data?.user) {
		return new Response(JSON.stringify({ code: 401, message: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const accessToken = session.data.oauth?.access_token;

	// Reject path-traversal and absolute-URL attempts before joining into the OBP URL.
	const rawPath = event.params.path ?? '';
	if (
		rawPath === '' ||
		rawPath.includes('..') ||
		rawPath.startsWith('/') ||
		rawPath.includes('://') ||
		rawPath.includes('\0')
	) {
		logger.warn(`Rejected proxy path: ${rawPath}`);
		return new Response(JSON.stringify({ code: 400, message: 'Invalid path' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const obpPath = `/obp/${rawPath}`;
	const queryString = event.url.search;
	const url = `${OBP_BASE_URL}${obpPath}${queryString}`;

	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};
	if (accessToken) {
		headers['Authorization'] = `Bearer ${accessToken}`;
	}

	const method = event.request.method;
	const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';

	logger.debug(`${method} ${obpPath}`);

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

	try {
		const fetchOptions: RequestInit = {
			method,
			headers,
			signal: controller.signal
		};

		if (hasBody) {
			fetchOptions.body = await event.request.text();
		}

		const response = await fetch(url, fetchOptions);
		clearTimeout(timeout);

		// Pass through the OBP-API response as-is
		const responseBody = await response.text();

		return new Response(responseBody, {
			status: response.status,
			headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' }
		});
	} catch (error: any) {
		clearTimeout(timeout);
		if (error.name === 'AbortError') {
			logger.error(`Timeout: ${method} ${obpPath}`);
			return new Response(JSON.stringify({ code: 504, message: `Request to ${obpPath} timed out` }), {
				status: 504,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		logger.error(`Error: ${method} ${obpPath}:`, error);
		return new Response(JSON.stringify({ code: 502, message: error.message || 'Bad Gateway' }), {
			status: 502,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

export const GET: RequestHandler = proxyRequest;
export const POST: RequestHandler = proxyRequest;
export const PUT: RequestHandler = proxyRequest;
export const DELETE: RequestHandler = proxyRequest;
export const PATCH: RequestHandler = proxyRequest;
