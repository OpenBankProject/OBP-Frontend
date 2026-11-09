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
import { obpRequests } from '$lib/server/obp';

type UserRow = { user_id?: string; username?: string; provider?: string };

/**
 * The user_id of the User with exactly this username (needs CanGetAnyUser).
 *
 * GET /obp/v7.0.0/users?username= filters across all identity providers, so a username used
 * by Users of more than one provider is refused rather than guessed.
 */
export async function userIdByUsername(username: string, token: string): Promise<string> {
	const response = await obpRequests.get(`/obp/v7.0.0/users?username=${encodeURIComponent(username)}`, token);
	const users: UserRow[] = (response?.users ?? []).filter((u: UserRow) => u?.username === username && u?.user_id);
	if (users.length === 0) throw new Error(`No user with username ${username}`);
	if (users.length > 1) throw new Error(`${users.length} users have the username ${username} (providers: ${users.map((u) => u.provider).join(', ')})`);
	return String(users[0].user_id);
}
