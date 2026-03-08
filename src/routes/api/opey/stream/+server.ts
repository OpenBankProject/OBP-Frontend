import { createLogger } from '$lib/utils/logger';
const logger = createLogger('OpeyStreamProxy');
import type { RequestEvent } from './$types';
import { env } from '$env/dynamic/private';

/**
 * POST /api/opey/stream
 *
 * Proxies streaming chat requests to the Opey service.
 * The browser sends to this same-origin endpoint (no CORS issues),
 * and SvelteKit forwards to Opey server-side, piping the SSE response back.
 */
export async function POST(event: RequestEvent) {
	const opeyBaseUrl = env.OPEY_BASE_URL || 'http://localhost:5000';
	const body = await event.request.text();
	const cookie = event.request.headers.get('cookie') || '';

	logger.debug('Proxying stream request to Opey');

	const opeyResponse = await fetch(`${opeyBaseUrl}/stream`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Cookie': cookie
		},
		body
	});

	// Forward any new cookies Opey sets
	const responseHeaders = new Headers({
		'Content-Type': opeyResponse.headers.get('Content-Type') || 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
	});

	const setCookie = opeyResponse.headers.get('set-cookie');
	if (setCookie) responseHeaders.set('Set-Cookie', setCookie);

	const threadId = opeyResponse.headers.get('X-Thread-ID');
	if (threadId) responseHeaders.set('X-Thread-ID', threadId);

	return new Response(opeyResponse.body, {
		status: opeyResponse.status,
		headers: responseHeaders
	});
}
