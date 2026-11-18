/*
 * Copyright (C) 2026 TESOBE GmbH
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
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('./obp', () => ({ obpRequests: { get: (...args: unknown[]) => get(...args) } }));

import { userByProviderPath, userByUsername } from './users';

const PROVIDER = 'https://oidc.example.com/obp-oidc';

beforeEach(() => get.mockReset());

describe('userByProviderPath', () => {
	it('encodes a provider that is a URL, so its slashes do not split the path', () => {
		expect(userByProviderPath(PROVIDER, 'alice')).toBe(
			'/obp/v5.1.0/users/provider/https%3A%2F%2Foidc.example.com%2Fobp-oidc/username/alice'
		);
	});

	it('encodes a username that holds an at sign, a plus or a space', () => {
		expect(userByProviderPath('p', 'a+b@c.com x')).toBe('/obp/v5.1.0/users/provider/p/username/a%2Bb%40c.com%20x');
	});
});

describe('userByUsername', () => {
	it('looks the user up at the identity provider the signed-in person used', async () => {
		get.mockResolvedValueOnce({ user_id: 'me', provider: PROVIDER }).mockResolvedValueOnce({ user_id: 'u-alice' });
		const user = await userByUsername('alice', 'token');
		expect(user.user_id).toBe('u-alice');
		expect(get).toHaveBeenNthCalledWith(1, '/obp/v5.1.0/users/current', 'token');
		expect(get).toHaveBeenNthCalledWith(2, userByProviderPath(PROVIDER, 'alice'), 'token');
	});

	it('never asks for a user by username alone', async () => {
		get.mockResolvedValueOnce({ user_id: 'me', provider: PROVIDER }).mockResolvedValueOnce({ user_id: 'u-alice' });
		await userByUsername('alice', 'token');
		for (const [path] of get.mock.calls) expect(String(path)).not.toMatch(/\/users\/username\//);
	});

	it('stops, and asks nothing more, when OBP-API does not say which provider the caller used', async () => {
		get.mockResolvedValueOnce({ user_id: 'me' });
		await expect(userByUsername('alice', 'token')).rejects.toThrow(/identity provider/);
		expect(get).toHaveBeenCalledTimes(1);
	});
});
