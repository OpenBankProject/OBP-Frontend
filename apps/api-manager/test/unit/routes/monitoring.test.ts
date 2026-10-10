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
// The session stands in as { accessToken } so a test can log a User in.
vi.mock('$lib/oauth/sessionHelper', () => ({
	SessionOAuthHelper: { getSessionOAuth: (session: any) => session }
}));

import { GET as logCacheGET } from '$lib/../routes/monitoring/log-cache/[level]/+server';
import { GET as telemetryGET } from '$lib/../routes/monitoring/telemetry/+server';
import {
	LOG_LEVELS,
	clearLogCache,
	clearRoleCheckCache,
	clearTelemetry,
	logTail,
	record,
	recordTiming,
	requestTelemetry,
	startTelemetry,
	telemetryReport,
	tokenMayUseAnyRole
} from '@obp/shared/server/monitoring';

describe('log cache', () => {
	beforeEach(() => clearLogCache());

	it('keeps lines per level, newest first, in OBP-API log cache shape', () => {
		record('error', 'first');
		record('warning', 'careful');
		record('error', 'second');
		expect(logTail('error').entries.map((e) => e.message)).toEqual(['second', 'first']);
		expect(logTail('error').entries[0].level).toBe('ERROR');
		expect(logTail('all').entries.map((e) => e.message)).toEqual(['second', 'careful', 'first']);
	});

	it('pages with limit and offset, and keeps at most 1000 lines of a level', () => {
		for (const n of [1, 2, 3, 4]) record('info', `line ${n}`);
		expect(logTail('info', 2, 1).entries.map((e) => e.message)).toEqual(['line 3', 'line 2']);
		for (let n = 0; n < 1005; n++) record('debug', `line ${n}`);
		expect(logTail('debug').entries).toHaveLength(1000);
		expect(logTail('debug').entries[0].message).toBe('line 1004');
	});
});

describe('telemetry', () => {
	beforeEach(() => clearTelemetry());
	afterEach(() => vi.unstubAllGlobals());

	it('reports timers in OBP-API Telemetry shape, named for the app', async () => {
		startTelemetry('manager', undefined);
		const event = { request: new Request('http://localhost/consumers/abc'), route: { id: '/(protected)/consumers/[consumer_id]' } };
		await requestTelemetry({ event, resolve: async () => new Response('', { status: 200 }) } as never);
		recordTiming('manager.http.requests', { status: '2xx', route: '/(protected)/consumers/[consumer_id]', method: 'GET' }, 1);
		const report = telemetryReport('abc123', 'manager.');
		expect(report.git_commit).toBe('abc123');
		expect(report.api_instance_id).toMatch(/^obp-manager_/);
		expect(report.meters).toHaveLength(1);
		expect(report.meters[0]).toMatchObject({
			name: 'manager.http.requests',
			type: 'timer',
			tags: { method: 'GET', route: '/(protected)/consumers/[consumer_id]', status: '2xx' },
			measurements: { count: 2 }
		});
		expect(telemetryReport('x').meters.map((m) => m.name)).toContain('process.memory.rss');
	});
});

describe('role check', () => {
	const fetchMock = vi.fn();
	beforeEach(() => {
		clearRoleCheckCache();
		fetchMock.mockReset();
		vi.stubGlobal('fetch', fetchMock);
	});
	afterEach(() => vi.unstubAllGlobals());

	const answer = (status: number, modes: string[] = []) =>
		Promise.resolve(new Response(JSON.stringify({ allowed_for_auth_modes: modes }), { status }));

	it('asks OBP-API at SYS with the Bearer token and reuses the answer for a minute', async () => {
		fetchMock.mockImplementation(() => answer(200, ['UserOrApplication']));
		expect(await tokenMayUseAnyRole('http://obp', 't', ['CanGetTelemetry'], 0)).toBe('allowed');
		expect(fetchMock.mock.calls[0][0]).toBe('http://obp/obp/v7.0.0/banks/SYS/my/roles/CanGetTelemetry');
		expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer t');
		await tokenMayUseAnyRole('http://obp', 't', ['CanGetTelemetry'], 59_999);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		await tokenMayUseAnyRole('http://obp', 't', ['CanGetTelemetry'], 60_000);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});

describe('monitoring endpoints', () => {
	// A fake OBP-API: what each token may do, as GET /banks/SYS/my/roles/ROLE answers it.
	const tokens: Record<string, Record<string, string[]>> = {
		'all-reader': { CanGetSystemLogCacheAll: ['UserOrApplication'] },
		'error-reader': { CanGetSystemLogCacheError: ['UserOrApplication'] },
		'info-reader': { CanGetSystemLogCacheInfo: ['UserOrApplication'] },
		'telemetry-reader': { CanGetTelemetry: ['UserOrApplication'] },
		'user-only': { CanGetSystemLogCacheAll: ['UserOnly'], CanGetTelemetry: ['UserOnly'] },
		'no-roles': {}
	};
	const fakeObpApi = vi.fn(async (url: string, init: any) => {
		const token = init.headers.Authorization.slice('Bearer '.length);
		if (!url.startsWith('http://obp/obp/v7.0.0/banks/SYS/my/roles/')) return new Response('{}', { status: 404 });
		if (!(token in tokens)) return new Response('{}', { status: 401 });
		const role = decodeURIComponent(url.split('/').pop()!);
		return new Response(JSON.stringify({ allowed_for_auth_modes: tokens[token][role] ?? [] }), { status: 200 });
	});

	const call = async (
		handler: any,
		path: string,
		token?: string,
		params: Record<string, string> = {},
		sessionToken?: string
	) => {
		const url = new URL(`http://localhost${path}`);
		const request = new Request(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
		const locals = { session: sessionToken ? { accessToken: sessionToken } : undefined };
		const response: Response = await handler({ request, url, params, locals });
		return { status: response.status, body: await response.json() };
	};
	const getLogs = (level: string, token?: string, query = '') =>
		call(logCacheGET, `/monitoring/log-cache/${level}${query}`, token, { level });
	const getTelemetry = (token?: string, query = '') => call(telemetryGET, `/monitoring/telemetry${query}`, token);

	beforeEach(() => {
		clearRoleCheckCache();
		clearLogCache();
		fakeObpApi.mockClear();
		vi.stubGlobal('fetch', fakeObpApi);
		publicEnv.PUBLIC_OBP_BASE_URL = 'http://obp';
		for (const level of LOG_LEVELS) record(level, `a ${level} line`);
	});
	afterEach(() => vi.unstubAllGlobals());

	const capitalised = (level: string) => level.charAt(0).toUpperCase() + level.slice(1);

	it.each(LOG_LEVELS)('returns the %s log cache to a token allowed its level Role or the All Role', async (level) => {
		tokens[`${level}-only`] = { [`CanGetSystemLogCache${capitalised(level)}`]: ['UserOrApplication'] };
		for (const token of [`${level}-only`, 'all-reader']) {
			const res = await getLogs(level, token);
			expect(res.status).toBe(200);
			expect(res.body.entries.map((e: any) => e.message)).toEqual([`a ${level} line`]);
		}
	});

	it.each(LOG_LEVELS)('refuses the %s log cache to tokens without its Roles, returning no lines', async (level) => {
		const otherLevel = level === 'error' ? 'info-reader' : 'error-reader';
		for (const token of ['no-roles', 'telemetry-reader', 'user-only', otherLevel]) {
			const res = await getLogs(level, token);
			expect(res.status).toBe(403);
			expect(res.body.entries).toBeUndefined();
		}
	});

	it('returns every level only with CanGetSystemLogCacheAll, not with a single level Role', async () => {
		const all = await getLogs('all', 'all-reader');
		expect(all.status).toBe(200);
		expect(all.body.entries).toHaveLength(5);
		const refused = await getLogs('all', 'error-reader');
		expect(refused.status).toBe(403);
		expect(refused.body.entries).toBeUndefined();
		expect(fakeObpApi.mock.calls.map((c) => c[0].split('/').pop())).toEqual([
			'CanGetSystemLogCacheAll',
			'CanGetSystemLogCacheAll'
		]);
	});

	it('answers 404 for an unknown level without asking OBP-API', async () => {
		const res = await getLogs('secrets', 'all-reader');
		expect(res.status).toBe(404);
		expect(fakeObpApi).not.toHaveBeenCalled();
	});

	it('returns Telemetry only with CanGetTelemetry', async () => {
		const ok = await getTelemetry('telemetry-reader');
		expect(ok.status).toBe(200);
		expect(ok.body.meters.length).toBeGreaterThan(0);
		for (const token of ['all-reader', 'user-only', 'no-roles']) {
			const res = await getTelemetry(token);
			expect(res.status).toBe(403);
			expect(res.body.meters).toBeUndefined();
		}
	});

	it('refuses without a token, or with one OBP-API does not accept, without returning data', async () => {
		for (const res of [await getLogs('error'), await getLogs('error', 'unknown-token'), await getTelemetry(), await getTelemetry('unknown-token')]) {
			expect(res.status).toBe(401);
			expect(res.body.entries).toBeUndefined();
			expect(res.body.meters).toBeUndefined();
		}
	});

	it("uses the logged-in User's session token when there is no Bearer header, with the same Roles", async () => {
		const ok = await call(logCacheGET, '/monitoring/log-cache/all', undefined, { level: 'all' }, 'all-reader');
		expect(ok.status).toBe(200);
		expect(ok.body.entries).toHaveLength(5);
		const refused = await call(telemetryGET, '/monitoring/telemetry', undefined, {}, 'all-reader');
		expect(refused.status).toBe(403);
		expect(refused.body.meters).toBeUndefined();
		const expired = await call(logCacheGET, '/monitoring/log-cache/error', undefined, { level: 'error' }, 'unknown-token');
		expect(expired.status).toBe(401);
		expect(expired.body.entries).toBeUndefined();
	});

	it('refuses with 503 when OBP-API cannot be asked', async () => {
		fakeObpApi.mockRejectedValueOnce(new Error('connection refused'));
		const unreachable = await getLogs('error', 'error-reader');
		expect(unreachable.status).toBe(503);
		expect(unreachable.body.entries).toBeUndefined();
		publicEnv.PUBLIC_OBP_BASE_URL = undefined;
		const noHost = await getTelemetry('telemetry-reader');
		expect(noHost.status).toBe(503);
		expect(noHost.body.meters).toBeUndefined();
	});

	it('passes limit, offset and name_prefix through', async () => {
		const paged = await getLogs('all', 'all-reader', '?limit=2&offset=1');
		expect(paged.body.entries.map((e: any) => e.message)).toEqual(['a warning line', 'a info line']);
		const prefixed = await getTelemetry('telemetry-reader', '?name_prefix=process.uptime');
		expect(prefixed.body.meters.map((m: any) => m.name)).toEqual(['process.uptime']);
	});
});
