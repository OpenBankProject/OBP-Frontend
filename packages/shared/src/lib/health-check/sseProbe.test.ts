/*
 * Copyright (C) 2025-2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
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
