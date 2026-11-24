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
import { describe, it, expect, vi, afterEach } from 'vitest';
import { aliveResponse, healthResponse, prefersJson, statusResponse, obpApiCheck, redisCheck, snapshotCheck, type StatusCheck } from './index';

const build = { version: '1.0.0', commit: 'abc1234', branch: 'main', buildTime: '2026-11-24T00:00:00Z' };
const passing = (name: string, essential = true): StatusCheck => ({ name, essential, run: async () => ({ ok: true }) });
const failing = (name: string, essential = true): StatusCheck => ({ name, essential, run: async () => ({ ok: false, detail: 'down' }) });
const request = (accept?: string) => new Request('http://localhost/status', { headers: accept ? { Accept: accept } : {} });

afterEach(() => vi.unstubAllGlobals());

describe('/alive and /health', () => {
	it('answers /alive with 200 and the JSON body true, not cached', async () => {
		const response = aliveResponse();
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('application/json');
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(await response.text()).toBe('true');
	});

	it('answers /health with 200 and {"status":"ok"}, not cached', async () => {
		const response = healthResponse();
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('application/json');
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(await response.text()).toBe('{"status":"ok"}');
	});
});

describe('prefersJson', () => {
	it.each([
		['application/json', true],
		['application/json, text/plain, */*', true],
		['text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', false],
		['text/html;q=0.5, application/json', true],
		['application/json;q=0.5, text/html', false],
		['application/json;q=0', false],
		['*/*', false]
	])('reads "%s" as JSON preferred: %s', (accept, expected) => {
		expect(prefersJson(accept)).toBe(expected);
	});

	it('gives HTML when there is no Accept header', () => {
		expect(prefersJson(null)).toBe(false);
	});
});

describe('statusResponse', () => {
	it('answers 200 with status ok and the build when every check passes', async () => {
		const response = await statusResponse(request('application/json'), { appName: 'Test', build, checks: [passing('obp_api'), passing('redis')] });
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('application/json');
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		const body = await response.json();
		expect(body).toMatchObject({ status: 'ok', app: 'Test', git_commit: 'abc1234', git_branch: 'main', checks: { obp_api: { status: 'ok' }, redis: { status: 'ok' } } });
		expect(typeof body.uptime_seconds).toBe('number');
	});

	it('answers 503 with status degraded when an essential check fails', async () => {
		const response = await statusResponse(request('application/json'), { appName: 'Test', build, checks: [passing('obp_api'), failing('redis')] });
		expect(response.status).toBe(503);
		const body = await response.json();
		expect(body.status).toBe('degraded');
		expect(body.checks.redis).toEqual({ status: 'fail', essential: true, detail: 'down' });
	});

	it('shows a failed check that is not essential as warn and still answers 200', async () => {
		const response = await statusResponse(request('application/json'), { appName: 'Test', build, checks: [passing('obp_api'), failing('consumer_scopes', false)] });
		expect(response.status).toBe(200);
		expect((await response.json()).checks.consumer_scopes.status).toBe('warn');
	});

	it('counts a check that throws as failed', async () => {
		const throwing: StatusCheck = { name: 'obp_api', essential: true, run: async () => { throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } }); } };
		const response = await statusResponse(request('application/json'), { appName: 'Test', build, checks: [throwing] });
		expect(response.status).toBe(503);
		expect((await response.json()).checks.obp_api.detail).toBe('could not connect (ECONNREFUSED)');
	});

	it('gives a browser an HTML page, with the same status code', async () => {
		const response = await statusResponse(request('text/html,application/xhtml+xml,*/*;q=0.8'), { appName: 'Test <App>', build, checks: [failing('redis')] });
		expect(response.status).toBe(503);
		expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		const html = await response.text();
		expect(html).toContain('<title>Test &lt;App&gt; - Status</title>');
		expect(html).toContain('degraded');
		expect(html).toContain('<th>redis</th>');
	});
});

describe('checks', () => {
	it('checks OBP-API at its v5.1.0 root', async () => {
		const fakeFetch = vi.fn(async () => new Response('{}', { status: 200 }));
		vi.stubGlobal('fetch', fakeFetch);
		expect(await obpApiCheck('http://obp/').run()).toEqual({ ok: true });
		expect(fakeFetch.mock.calls[0][0]).toBe('http://obp/obp/v5.1.0/root');
	});

	it('fails the OBP-API check on an error status, or when no address is set', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 502 })));
		expect(await obpApiCheck('http://obp').run()).toEqual({ ok: false, detail: 'HTTP 502' });
		expect(await obpApiCheck(undefined).run()).toEqual({ ok: false, detail: 'PUBLIC_OBP_BASE_URL is not set' });
	});

	it('passes the Redis check only on PONG', async () => {
		const provider = (answer: string) => ({ getClient: () => ({ ping: async () => answer }) }) as never;
		expect(await redisCheck(provider('PONG')).run()).toEqual({ ok: true });
		expect((await redisCheck(provider('nope')).run()).ok).toBe(false);
	});

	it('reads a background check from its last snapshot', async () => {
		const source = (status: 'healthy' | 'unhealthy' | 'unknown') => ({ getSnapshot: () => ({ service: 'x', status, lastChecked: '', conecutiveFailures: 0 }) });
		expect(await snapshotCheck('consumer_scopes', source('healthy')).run()).toEqual({ ok: true });
		expect(await snapshotCheck('consumer_scopes', source('unknown')).run()).toEqual({ ok: false, detail: 'not checked yet' });
		expect((await snapshotCheck('consumer_scopes', source('unhealthy')).run()).ok).toBe(false);
		expect(snapshotCheck('consumer_scopes', source('healthy')).essential).toBe(false);
	});
});
