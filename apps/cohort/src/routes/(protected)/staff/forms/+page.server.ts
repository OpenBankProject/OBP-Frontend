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
import { fail, redirect } from '@sveltejs/kit';
import { FORM_PURPOSES, type FormPurpose } from '$lib/forms';
import { CALL, FORM, PROGRAMME } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { listForms } from '$lib/server/forms';
import { createRecord, idOf, listRecords, userToken } from '$lib/server/records';
import { staffAccess } from '$lib/server/staffAccess';
import { requestRole } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

const CREATE_ROLE = `CanCreateDynamicEntityRecord_${FORM}`;

/** Every form, with what it is for: forms, calls and programmes are public records. */
export const load: PageServerLoad = async ({ locals }) => {
	const [forms, calls, programmes, access] = await Promise.allSettled([
		listForms(),
		listRecords(CALL, 'public'),
		listRecords(PROGRAMME, 'public'),
		staffAccess(userToken(locals)!)
	]);
	const callList = calls.status === 'fulfilled' ? calls.value.map((c) => ({ id: idOf(CALL, c), title: String(c.title ?? '') })) : [];
	const programmeList = programmes.status === 'fulfilled' ? programmes.value.map((p) => ({ id: idOf(PROGRAMME, p), name: String(p.name ?? '') })) : [];
	const roles = access.status === 'fulfilled' ? access.value.roles : [];
	return {
		forms: (forms.status === 'fulfilled' ? forms.value : [])
			.map((f) => ({
				...f,
				target: f.purpose === 'survey' ? (programmeList.find((p) => p.id === f.programme_id)?.name ?? f.programme_id) : (callList.find((c) => c.id === f.call_id)?.title ?? f.call_id)
			}))
			.sort((a, b) => a.target.localeCompare(b.target) || b.version - a.version),
		error: forms.status === 'rejected' ? messageOf(forms.reason) : null,
		calls: callList,
		programmes: programmeList,
		lackingCreate: roles.find((r) => r.role_name === CREATE_ROLE && !r.held) ?? null,
		space: access.status === 'fulfilled' ? access.value.space : '',
		entitlementRequestsUrl: access.status === 'fulfilled' ? access.value.entitlementRequestsUrl : null
	};
};

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export const actions: Actions = {
	/** A new draft form, version 1 for its call or programme (or the next version, when one exists). */
	create: async ({ locals, request }) => {
		const form = await request.formData();
		const purpose = str(form, 'purpose') as FormPurpose;
		const title = str(form, 'title');
		const target = str(form, purpose === 'survey' ? 'programme_id' : 'call_id');
		if (!(FORM_PURPOSES as readonly string[]).includes(purpose) || !title || !target) return fail(400, { error: 'invalid' });
		const existing = (await listForms().catch(() => [])).filter((f) => f.purpose === purpose && (purpose === 'survey' ? f.programme_id : f.call_id) === target);
		let id = '';
		try {
			const created = await createRecord(
				FORM,
				'',
				{
					purpose,
					title,
					...(str(form, 'title_ar') ? { title_ar: str(form, 'title_ar') } : {}),
					[purpose === 'survey' ? 'programme_id' : 'call_id']: target,
					status: 'draft',
					version: purpose === 'survey' ? 1 : Math.max(0, ...existing.map((f) => f.version)) + 1,
					questions: '[]'
				},
				userToken(locals)!
			);
			id = idOf(FORM, created);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		redirect(303, `/staff/forms/${id}`);
	},
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!)
};
