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

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_OBP_BASE_URL: 'https://obp.example.com' } }));
vi.mock('$lib/oauth/sessionHelper', () => ({
	SessionOAuthHelper: { getSessionOAuth: vi.fn() }
}));

import { fallback } from '$lib/../routes/proxy/[...path]/+server';
import { SessionOAuthHelper } from '$lib/oauth/sessionHelper';

const getSessionOAuth = vi.mocked(SessionOAuthHelper.getSessionOAuth);

function makeEvent({
	path,
	method = 'GET',
	search = '',
	hasUser = true,
	body
}: {
	path: string;
	method?: string;
	search?: string;
	hasUser?: boolean;
	body?: string;
}) {
	const target = `http://localhost/proxy/${path}${search}`;
	return {
		params: { path },
		request: new Request(target, {
			method,
			...(body !== undefined ? { body } : {})
		}),
		locals: { session: hasUser ? { data: { user: { user_id: 'u-1' } } } : { data: {} } },
		url: new URL(target)
	} as never;
}

describe('proxy fallback handler', () => {
	beforeEach(() => {
		getSessionOAuth.mockReset();
		// Default: an authenticated session with a usable access token.
		getSessionOAuth.mockReturnValue({ accessToken: 'access-token-123' } as never);
	});

	it('returns 401 when there is no logged-in user', async () => {
		const res = await fallback(makeEvent({ path: 'obp/v6.0.0/banks', hasUser: false }));
		expect(res.status).toBe(401);
		await expect(res.json()).resolves.toEqual({ message: 'Unauthorized' });
	});

	it('returns 401 when the session has no access token', async () => {
		getSessionOAuth.mockReturnValue(null as never);
		const res = await fallback(makeEvent({ path: 'obp/v6.0.0/banks' }));
		expect(res.status).toBe(401);
		await expect(res.json()).resolves.toEqual({ message: 'No API access token available' });
	});

	const badPaths: Array<[string, string]> = [
		['empty path', ''],
		['parent traversal', '..'],
		['embedded traversal', 'obp/../../etc/passwd'],
		['leading slash / absolute path', '/obp/v6.0.0/banks'],
		['absolute URL', 'https://evil.example.com/steal'],
		['null byte', 'obp\0/banks']
	];

	for (const [label, path] of badPaths) {
		it(`rejects ${label} with 400 and never calls fetch`, async () => {
			const res = await fallback(makeEvent({ path }));
			expect(res.status).toBe(400);
			await expect(res.json()).resolves.toEqual({ message: 'Invalid path' });
			expect(global.fetch).not.toHaveBeenCalled();
		});
	}

	it('forwards a valid path to OBP with the bearer token and query string', async () => {
		const upstream = vi
			.fn()
			.mockResolvedValue(
				new Response('{"banks":[]}', { status: 200, headers: { 'content-type': 'application/json' } })
			);
		global.fetch = upstream as never;

		const res = await fallback(makeEvent({ path: 'obp/v6.0.0/banks', search: '?limit=5' }));

		expect(upstream).toHaveBeenCalledTimes(1);
		const [calledUrl, options] = upstream.mock.calls[0];
		expect(calledUrl).toBe('https://obp.example.com/obp/v6.0.0/banks?limit=5');
		expect((options.headers as Record<string, string>).Authorization).toBe('Bearer access-token-123');
		expect(res.status).toBe(200);
	});
});
