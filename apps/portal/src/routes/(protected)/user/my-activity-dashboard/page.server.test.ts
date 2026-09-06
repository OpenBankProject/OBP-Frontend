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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load } from './+page.server.js';
import { OBPRequestError, MY_METRICS_PAGE_SIZE, MY_METRICS_SUMMARY_LIMIT } from '@obp/shared/obp';

vi.mock('$lib/obp/requests', () => ({
	obp_requests: {
		get: vi.fn()
	}
}));

vi.mock('$env/dynamic/private', () => ({
	env: { API_EXPLORER_URL: 'https://explorer.example.com' }
}));

import { obp_requests } from '$lib/obp/requests';

const metric = (i: number) => ({
	user_id: 'u1',
	url: `/obp/v7.0.0/banks/${i}`,
	date: '2026-08-29T10:00:00Z',
	username: 'alice',
	app_name: 'Portal',
	developer_email: '',
	implemented_by_partial_function: 'getBank',
	implemented_in_version: 'v7.0.0',
	consumer_id: 'c1',
	verb: 'GET',
	correlation_id: `corr-${i}`,
	duration: 12,
	source_ip: '',
	target_ip: '',
	status_code: 200,
	operation_id: 'OBPv7.0.0-getBank'
});

// `token: null` means "no session token" (an explicit `undefined` would trigger the default).
const run = (search = '', token: string | null = 'tok') =>
	load({
		locals: { session: { data: { oauth: token ? { access_token: token } : undefined } } },
		url: new URL(`http://localhost/user/my-activity-dashboard${search}`)
	} as never);

describe('Activity Dashboard load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects with 401 when there is no access token', async () => {
		await expect(run('', null)).rejects.toMatchObject({ status: 401 });
		expect(obp_requests.get).not.toHaveBeenCalled();
	});

	it('calls GET /my/metrics with an explicit from_date and the fixed page size', async () => {
		vi.mocked(obp_requests.get).mockResolvedValue({ metrics: [metric(1)] });

		const result = await run('?verb=get&url=banks');

		// Page, summary and consumers are fetched in parallel; the page call is first.
		expect(obp_requests.get).toHaveBeenCalledTimes(3);
		const [endpoint, token] = vi.mocked(obp_requests.get).mock.calls[0];
		expect(token).toBe('tok');
		expect(endpoint).toMatch(/^\/obp\/v7\.0\.0\/my\/metrics\?/);
		const params = new URLSearchParams(endpoint.split('?')[1]);
		expect(params.get('from_date')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(params.get('limit')).toBe(String(MY_METRICS_PAGE_SIZE));
		expect(params.get('offset')).toBe('0');
		expect(params.get('verb')).toBe('GET');
		expect(params.get('url')).toBe('banks');

		expect(result.metrics).toHaveLength(1);
		expect(result.error).toBeNull();
		expect(result.apiExplorerUrl).toBe('https://explorer.example.com');
		expect(result.filters.verb).toBe('GET');
	});

	it('fetches a summary window with the same filters from offset 0, and the consumers', async () => {
		vi.mocked(obp_requests.get).mockResolvedValue({ metrics: [metric(1), metric(2)] });

		const result = await run('?page=2&verb=post&consumer_id=c9');

		const endpoints = vi.mocked(obp_requests.get).mock.calls.map(([e]) => e);
		const summaryEndpoint = endpoints[1];
		const params = new URLSearchParams(summaryEndpoint.split('?')[1]);
		expect(summaryEndpoint).toMatch(/^\/obp\/v7\.0\.0\/my\/metrics\?/);
		expect(params.get('limit')).toBe(String(MY_METRICS_SUMMARY_LIMIT));
		expect(params.get('offset')).toBe('0');
		expect(params.get('verb')).toBe('POST');
		expect(params.get('consumer_id')).toBe('c9');
		expect(endpoints[2]).toBe('/obp/v6.0.0/management/users/current/consumers');

		expect(result.summary?.total).toBe(2);
		expect(result.summary?.topEndpoints[0]).toMatchObject({ label: 'OBPv7.0.0-getBank', count: 2 });
		// The selected consumer is kept in the dropdown even though nobody reported it by name;
		// neither is "mine" here (the consumers mock has no `consumers`), so it's alphabetical: "c9" < "Portal".
		expect(result.consumerOptions).toEqual([
			{ consumer_id: 'c9', app_name: '', mine: false },
			{ consumer_id: 'c1', app_name: 'Portal', mine: false }
		]);
	});

	it('degrades summary and consumers to empty when only those fetches fail', async () => {
		vi.mocked(obp_requests.get).mockImplementation(async (endpoint: string) => {
			if (endpoint.includes('limit=' + MY_METRICS_SUMMARY_LIMIT)) throw new Error('summary boom');
			if (endpoint.includes('/consumers')) throw new Error('consumers boom');
			return { metrics: [metric(1)] };
		});

		const result = await run();

		expect(result.error).toBeNull();
		expect(result.metrics).toHaveLength(1);
		expect(result.summary).toBeNull();
		expect(result.consumerOptions).toEqual([]);
	});

	it('never forwards identity filters the endpoint rejects', async () => {
		vi.mocked(obp_requests.get).mockResolvedValue({ metrics: [] });

		await run('?username=bob&user_id=u2&anon=true');

		const [endpoint] = vi.mocked(obp_requests.get).mock.calls[0];
		expect(endpoint).not.toContain('username=');
		expect(endpoint).not.toContain('user_id=');
		expect(endpoint).not.toContain('anon=');
	});

	it('reports hasMore only when a full page came back', async () => {
		vi.mocked(obp_requests.get).mockResolvedValue({
			metrics: Array.from({ length: MY_METRICS_PAGE_SIZE }, (_, i) => metric(i))
		});
		expect((await run()).hasMore).toBe(true);

		vi.mocked(obp_requests.get).mockResolvedValue({ metrics: [metric(1), metric(2), metric(3)] });
		expect((await run()).hasMore).toBe(false);
	});

	it('maps ?page= to the API offset', async () => {
		vi.mocked(obp_requests.get).mockResolvedValue({ metrics: [] });

		const result = await run('?page=2');

		const [endpoint] = vi.mocked(obp_requests.get).mock.calls[0];
		expect(new URLSearchParams(endpoint.split('?')[1]).get('offset')).toBe(
			String(2 * MY_METRICS_PAGE_SIZE)
		);
		expect(result.filters.page).toBe(2);
	});

	it('returns the OBP error message in data instead of throwing', async () => {
		vi.mocked(obp_requests.get).mockRejectedValue(
			new OBPRequestError(400, 'OBP-10058: User identity filter parameters are not supported.')
		);

		const result = await run();

		expect(result.metrics).toEqual([]);
		expect(result.hasMore).toBe(false);
		expect(result.error).toBe('OBP-10058: User identity filter parameters are not supported.');
	});

	it('falls back to a generic message for non-OBP failures', async () => {
		vi.mocked(obp_requests.get).mockRejectedValue(new Error('socket hang up'));

		const result = await run();

		expect(result.metrics).toEqual([]);
		expect(result.error).toMatch(/Could not fetch your activity/);
	});
});
