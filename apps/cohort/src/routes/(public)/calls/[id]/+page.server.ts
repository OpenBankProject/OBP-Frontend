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
import { error, redirect } from '@sveltejs/kit';
import { loginUrlReturningTo } from '@obp/shared/server/auth';
import { isCallOpen } from '$lib/applications';
import { APPLICATION, CALL, PROGRAMME } from '$lib/server/entities/definitions';
import { createRecord, getRecord, idOf, listRecords, userToken } from '$lib/server/records';
import type { Actions, PageServerLoad } from './$types';

async function publicCall(id: string) {
	try {
		return await getRecord(CALL, 'public', id);
	} catch {
		error(404, 'Call not found');
	}
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const call = await publicCall(params.id);
	const programme = await getRecord(PROGRAMME, 'public', String(call.programme_id)).catch(() => null);
	const token = userToken(locals);
	const mine = token
		? (await listRecords(APPLICATION, 'my', token).catch(() => [])).find((a) => a.call_id === params.id)
		: undefined;
	return {
		call: {
			id: params.id,
			title: String(call.title ?? ''),
			description: String(call.description ?? ''),
			opens_at: String(call.opens_at ?? ''),
			closes_at: String(call.closes_at ?? ''),
			open: isCallOpen(call)
		},
		programme: programme ? String(programme.name ?? '') : '',
		myApplicationId: mine ? idOf(APPLICATION, mine) : null
	};
};

export const actions: Actions = {
	/** Start an application for this call, or continue the one already started. */
	apply: async ({ params, locals }) => {
		const token = userToken(locals);
		if (!locals.session.data.user || !token) redirect(303, loginUrlReturningTo(`/calls/${params.id}`));
		const call = await publicCall(params.id);
		const existing = (await listRecords(APPLICATION, 'my', token)).find((a) => a.call_id === params.id);
		if (existing) redirect(303, `/applications/${idOf(APPLICATION, existing)}`);
		if (!isCallOpen(call)) error(400, 'This call is not open');
		const created = await createRecord(APPLICATION, 'my', { call_id: params.id, status: 'draft' }, token);
		redirect(303, `/applications/${idOf(APPLICATION, created)}`);
	}
};
