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
import { obpRequests } from './obp';

/**
 * The path that finds one User by identity provider and username. A username is only unique within its identity
 * provider, so the same name can belong to different people at different providers. The provider is often a URL, so it
 * is encoded to keep its slashes out of the path.
 */
export function userByProviderPath(provider: string, username: string): string {
	return `/obp/v5.1.0/users/provider/${encodeURIComponent(provider)}/username/${encodeURIComponent(username)}`;
}

/**
 * Find a User by username, at the identity provider the signed-in person used. The regulator's staff and the people
 * they name sign in through the same provider, so this finds exactly one User. If the name exists only at another
 * provider, OBP-API answers that no such User exists, instead of returning someone else. Needs the system Role
 * CanGetAnyUser.
 */
export async function userByUsername(
	username: string,
	token: string
): Promise<{ user_id: string; provider?: string; entitlements?: { list: Array<{ role_name: string; bank_id: string }> } }> {
	const me = await obpRequests.get('/obp/v5.1.0/users/current', token);
	const provider = String(me?.provider ?? '');
	if (!provider) throw new Error('OBP-API did not say which identity provider you signed in with, so the User cannot be found.');
	return obpRequests.get(userByProviderPath(provider, username), token);
}
