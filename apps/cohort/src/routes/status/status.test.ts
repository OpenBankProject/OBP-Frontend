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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const publicEnv = vi.hoisted(() => ({ PUBLIC_OBP_BASE_URL: 'http://obp' as string | undefined }));
vi.mock('$env/dynamic/public', () => ({ env: publicEnv }));
// A stand-in Redis: the test sets what PING answers.
const redis = vi.hoisted(() => ({ pingAnswer: 'PONG' as string }));
vi.mock('$lib/server/redis', () => ({ redisService: { getClient: () => ({ ping: async () => redis.pingAnswer }) } }));
// A stand-in Consumer Scopes check: the test sets its last result.
const scopes = vi.hoisted(() => ({ status: 'healthy' as 'healthy' | 'unhealthy' | 'unknown' }));
vi.mock('$lib/server/consumerScopes', () => ({
	consumerScopesCheck: { getSnapshot: () => ({ service: 'OBP Consumer scopes', status: scopes.status, lastChecked: '', conecutiveFailures: 0 }) }
}));

import { GET } from './+server';

const getStatus = async (accept = 'application/json') =>
	(await (GET as (event: unknown) => Promise<Response>)({ request: new Request('http://localhost/status', { headers: { Accept: accept } }) })) as Response;

describe('GET /status', () => {
	const obpStatus = { code: 200 };
	beforeEach(() => {
		obpStatus.code = 200;
		redis.pingAnswer = 'PONG';
		scopes.status = 'healthy';
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: obpStatus.code })));
	});
	afterEach(() => vi.unstubAllGlobals());

	it('answers 200 and status ok when OBP-API and Redis answer', async () => {
		const response = await getStatus();
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		const body = await response.json();
		expect(body.status).toBe('ok');
		expect(Object.keys(body.checks)).toEqual(['obp_api', 'redis', 'consumer_scopes']);
	});

	it('answers 503 when OBP-API does not answer', async () => {
		obpStatus.code = 502;
		const response = await getStatus();
		expect(response.status).toBe(503);
		expect((await response.json()).checks.obp_api.status).toBe('fail');
	});

	it('answers 503 when Redis does not answer', async () => {
		redis.pingAnswer = 'nope';
		expect((await getStatus()).status).toBe(503);
	});

	it('still answers 200 when only the Consumer Scopes check fails', async () => {
		scopes.status = 'unhealthy';
		const response = await getStatus();
		expect(response.status).toBe(200);
		expect((await response.json()).checks.consumer_scopes.status).toBe('warn');
	});

	it('gives a browser an HTML page', async () => {
		const response = await getStatus('text/html,application/xhtml+xml,*/*;q=0.8');
		expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
		expect(await response.text()).toContain('<h2>Checks</h2>');
	});
});
