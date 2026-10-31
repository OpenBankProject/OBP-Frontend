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
import { fail } from '@sveltejs/kit';
import { messageOf } from '$lib/server/errors';
import { userToken } from '$lib/server/records';
import { isStaffRole, requestStaffRole, staffAccess } from '$lib/server/staffAccess';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const access = await staffAccess(userToken(locals)!);
	// Keep the session's copy of the User's Roles current, as the header shows their count.
	if (access.user?.user_id) {
		await locals.session.setData({ ...locals.session.data, user: access.user });
		await locals.session.save();
	}
	const { user: _user, ...rest } = access;
	return rest;
};

export const actions: Actions = {
	request: async ({ locals, request }) => {
		const roleName = String((await request.formData()).get('role_name') ?? '');
		if (!isStaffRole(roleName)) return fail(400, { error: roleName });
		try {
			await requestStaffRole(roleName, userToken(locals)!);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		return { requested: roleName };
	}
};
