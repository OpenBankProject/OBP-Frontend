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
import { error, fail, isActionFailure, redirect } from '@sveltejs/kit';
import { CALL, PROGRAMME } from '$lib/server/entities/definitions';
import { getRecord, idOf, listRecords, updateRecord, userToken } from '$lib/server/records';
import { staffAccess } from '$lib/server/staffAccess';
import { readCallForm, requestRole, write } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

const UPDATE_ROLE = `CanUpdateDynamicEntityRecord_${CALL}`;

/** Editing a call needs CanUpdateDynamicEntityRecord_cohort_call; without it the page offers to request it. */
export const load: PageServerLoad = async ({ params, locals }) => {
	const call = await getRecord(CALL, 'public', params.id).catch(() => error(404, 'Call not found'));
	const [programmes, access] = await Promise.all([
		listRecords(PROGRAMME, 'public').catch(() => []),
		staffAccess(userToken(locals)!).catch(() => null)
	]);
	const role = access?.roles.find((r) => r.role_name === UPDATE_ROLE);
	return {
		call,
		programmes: programmes.map((p) => ({ id: idOf(PROGRAMME, p), name: String(p.name ?? '') })),
		lackingUpdate: role && !role.held ? role : null,
		space: access?.space ?? '',
		entitlementRequestsUrl: access?.entitlementRequestsUrl ?? null
	};
};

export const actions: Actions = {
	save: async ({ params, locals, request }) => {
		const record = readCallForm(await request.formData());
		if (!record.programme_id || !record.title) return fail(400, { form: 'save', error: 'title' });
		const result = await write('save', () => updateRecord(CALL, '', params.id, record, userToken(locals)!), {});
		if (isActionFailure(result)) return result;
		redirect(303, `/staff/calls/${params.id}`);
	},
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!)
};
