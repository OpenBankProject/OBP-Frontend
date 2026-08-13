import { describe, it, expect } from 'vitest';
import { sseProbeResponse, runSseProbe } from './sseProbe.js';

// A response with the same events as the real probe, but delivered in a single
// chunk at once — what a buffering reverse proxy turns the stream into.
function bufferedResponse(): Response {
	return new Response(':ok\n\ndata: {"seq":1}\n\ndata: {"seq":2}\n\n', {
		headers: { 'Content-Type': 'text/event-stream' }
	});
}

describe('runSseProbe', () => {
	it('reports healthy for a genuinely streamed response', async () => {
		const result = await runSseProbe({
			spacingMs: 200,
			fetchFn: async () => sseProbeResponse(200)
		});
		expect(result.ok).toBe(true);
		expect(result.buffered).toBe(false);
		expect(result.eventSpreadMs).toBeGreaterThanOrEqual(100);
	});

	it('detects a buffered stream', async () => {
		const result = await runSseProbe({ fetchFn: async () => bufferedResponse() });
		expect(result.ok).toBe(false);
		expect(result.buffered).toBe(true);
		expect(result.error).toContain('buffering');
	});

	it('reports an HTTP error status', async () => {
		const result = await runSseProbe({
			fetchFn: async () => new Response('nope', { status: 502 })
		});
		expect(result.ok).toBe(false);
		expect(result.error).toContain('502');
	});

	it('reports a truncated stream', async () => {
		const result = await runSseProbe({
			fetchFn: async () =>
				new Response('data: {"seq":1}\n\n', {
					headers: { 'Content-Type': 'text/event-stream' }
				})
		});
		expect(result.ok).toBe(false);
		expect(result.error).toContain('1 of 2 events');
	});

	it('reports a network failure', async () => {
		const result = await runSseProbe({
			fetchFn: async () => {
				throw new Error('Failed to fetch');
			}
		});
		expect(result.ok).toBe(false);
		expect(result.error).toBe('Failed to fetch');
	});
});
