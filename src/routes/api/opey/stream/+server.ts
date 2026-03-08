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
 *
 * Uses a ReadableStream with explicit chunk-by-chunk enqueue to prevent buffering.
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

	if (!opeyResponse.ok || !opeyResponse.body) {
		return new Response(opeyResponse.body, {
			status: opeyResponse.status,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// Forward any new cookies Opey sets
	const responseHeaders = new Headers({
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache, no-transform',
		'Connection': 'keep-alive',
		'X-Accel-Buffering': 'no',
	});

	const setCookie = opeyResponse.headers.get('set-cookie');
	if (setCookie) responseHeaders.set('Set-Cookie', setCookie);

	const threadId = opeyResponse.headers.get('X-Thread-ID');
	if (threadId) responseHeaders.set('X-Thread-ID', threadId);

	// Create a new ReadableStream that reads from the upstream response
	// chunk by chunk, enqueuing each chunk immediately to prevent buffering.
	const reader = opeyResponse.body.getReader();
	const stream = new ReadableStream({
		async pull(controller) {
			const { done, value } = await reader.read();
			if (done) {
				controller.close();
				return;
			}
			controller.enqueue(value);
		},
		cancel() {
			reader.cancel();
		}
	});

	return new Response(stream, {
		status: opeyResponse.status,
		headers: responseHeaders
	});
}
