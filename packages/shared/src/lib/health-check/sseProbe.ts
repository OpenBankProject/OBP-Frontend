// Browser → Node SSE transport probe.
//
// The live-streaming features (Portal chat, Manager metrics/log-cache) run over
// SSE from the browser to the app's /backend/*/stream endpoints, then gRPC from
// the app server to OBP-API. The server-side gRPC health check covers the second
// hop only; this probe covers the first. The server emits two events a fixed
// interval apart and closes; the browser measures when each event *arrives*.
// Both arriving together means something between the browser and the Node
// process (typically a reverse proxy) is buffering the response — the exact
// failure mode that breaks live streaming while every request/response check
// stays green.
//
// The probe response deliberately uses the same headers as the real streaming
// endpoints and no proxy-specific opt-outs (e.g. X-Accel-Buffering), so it is
// subject to the same proxy behavior they are.

export const SSE_PROBE_PATH = '/backend/status/stream';
export const SSE_PROBE_EVENT_COUNT = 2;
export const SSE_PROBE_SPACING_MS = 700;

/** The probe endpoint's response — used by /backend/status/stream in each app. */
export function sseProbeResponse(spacingMs: number = SSE_PROBE_SPACING_MS): Response {
	const encoder = new TextEncoder();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(encoder.encode(':ok\n\ndata: {"seq":1}\n\n'));
			timer = setTimeout(() => {
				controller.enqueue(encoder.encode('data: {"seq":2}\n\n'));
				controller.close();
			}, spacingMs);
		},
		cancel() {
			clearTimeout(timer);
		}
	});
	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
}

export interface SseProbeResult {
	ok: boolean;
	/** ms from request start until the first event arrived */
	timeToFirstEventMs?: number;
	/** ms between arrival of the first and last event — near zero means buffered */
	eventSpreadMs?: number;
	buffered?: boolean;
	error?: string;
}

/**
 * Runs in the browser: reads the probe stream and judges the SSE transport.
 * Unhealthy when the stream errors, times out, or the events arrive together
 * (buffered by a proxy) instead of spaced as the server sent them.
 */
export async function runSseProbe(
	options: {
		timeoutMs?: number;
		spacingMs?: number;
		path?: string;
		fetchFn?: typeof fetch;
	} = {}
): Promise<SseProbeResult> {
	const {
		timeoutMs = 5000,
		spacingMs = SSE_PROBE_SPACING_MS,
		path = SSE_PROBE_PATH,
		fetchFn = fetch
	} = options;

	const start = performance.now();
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
	try {
		const res = await fetchFn(path, {
			signal: controller.signal,
			headers: { accept: 'text/event-stream' }
		});
		if (!res.ok) {
			return { ok: false, error: `Unexpected status code: ${res.status}` };
		}
		if (!res.body) {
			return { ok: false, error: 'Response has no body stream' };
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		const eventArrivals: number[] = [];
		let pending = '';
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			pending += decoder.decode(value, { stream: true });
			const blocks = pending.split('\n\n');
			pending = blocks.pop() ?? '';
			const now = performance.now();
			for (const block of blocks) {
				if (block.split('\n').some((line) => line.startsWith('data:'))) {
					eventArrivals.push(now);
				}
			}
		}

		if (eventArrivals.length < SSE_PROBE_EVENT_COUNT) {
			return {
				ok: false,
				error: `Stream ended after ${eventArrivals.length} of ${SSE_PROBE_EVENT_COUNT} events`
			};
		}

		const timeToFirstEventMs = Math.round(eventArrivals[0] - start);
		const eventSpreadMs = Math.round(eventArrivals[eventArrivals.length - 1] - eventArrivals[0]);
		// The server spaced the events spacingMs apart; arriving in less than half
		// that means they were held back and delivered together.
		const buffered = eventSpreadMs < spacingMs / 2;
		return {
			ok: !buffered,
			timeToFirstEventMs,
			eventSpreadMs,
			buffered,
			error: buffered
				? `Events arrived ${eventSpreadMs}ms apart though the server spaced them ${spacingMs}ms apart — a proxy between the browser and the app server is buffering SSE responses, which breaks live streaming`
				: undefined
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { ok: false, error: msg === 'timeout' ? 'Request timeout' : msg };
	} finally {
		clearTimeout(timer);
	}
}
