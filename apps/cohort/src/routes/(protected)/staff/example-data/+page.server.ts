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
import { CALL, PROGRAMME } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { addExampleData, examples } from '$lib/server/exampleData';
import { userToken } from '$lib/server/records';
import { staffAccess } from '$lib/server/staffAccess';
import { requestRole } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

/** The Roles adding example data needs: creating programmes and calls. Applications need none. */
const NEEDED = [`CanCreateDynamicEntityRecord_${PROGRAMME}`, `CanCreateDynamicEntityRecord_${CALL}`];

export const load: PageServerLoad = async ({ locals }) => {
	const access = await staffAccess(userToken(locals)!).catch(() => null);
	return {
		examples: examples().map((e) => ({
			name: e.programme.name,
			status: String(e.programme.status),
			calls: e.calls.map((c) => ({ title: c.title, status: c.status, applications: c.applications.length }))
		})),
		lacking: (access?.roles ?? []).filter((r) => NEEDED.includes(r.role_name) && !r.held),
		space: access?.space ?? '',
		entitlementRequestsUrl: access?.entitlementRequestsUrl ?? null
	};
};

export const actions: Actions = {
	add: async ({ locals }) => {
		try {
			const user = locals.session.data.user;
			const added = await addExampleData(userToken(locals)!, {
				user_id: user?.user_id ?? '',
				username: user?.username ?? 'Example Applicant',
				email: user?.email ?? ''
			});
			return { form: 'add', added };
		} catch (err) {
			// What was created before the refusal stays; adding again skips it.
			return fail(400, { form: 'add', error: messageOf(err) });
		}
	},
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!)
};
