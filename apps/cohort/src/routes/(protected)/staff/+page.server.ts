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
import { latestDecision } from '$lib/screening';
import { APPLICATION, CALL, PROGRAMME, SCREENING_DECISION } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { createRecord, idOf, listRecords, userToken } from '$lib/server/records';
import { staffAccess } from '$lib/server/staffAccess';
import { readCallForm, readProgrammeForm, requestRole, write } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

/**
 * Programmes and calls are read publicly; every application is read through the community URL, which needs
 * CanGetDynamicEntityRecord_cohort_application at Cohort's space. Where the User lacks a Role, the section offers to
 * request it instead.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const token = userToken(locals);
	const [programmes, calls, applications, decisions] = await Promise.allSettled([
		listRecords(PROGRAMME, 'public'),
		listRecords(CALL, 'public'),
		listRecords(APPLICATION, 'community', token),
		listRecords(SCREENING_DECISION, '', token)
	]);
	const decisionList = decisions.status === 'fulfilled' ? decisions.value : [];
	const access = await staffAccess(token!).catch(() => null);
	const roles = Object.fromEntries((access?.roles ?? []).map((r) => [r.role_name, r]));
	const programmeList = programmes.status === 'fulfilled' ? programmes.value : [];
	const callList = calls.status === 'fulfilled' ? calls.value : [];
	const programmeNames = new Map(programmeList.map((p) => [idOf(PROGRAMME, p), String(p.name ?? '')]));
	const callTitles = new Map(callList.map((c) => [idOf(CALL, c), String(c.title ?? '')]));
	return {
		programmes: programmeList.map((p) => ({ id: idOf(PROGRAMME, p), name: String(p.name ?? ''), status: String(p.status ?? '') })),
		calls: callList.map((c) => ({
			id: idOf(CALL, c),
			title: String(c.title ?? ''),
			status: String(c.status ?? ''),
			programme: programmeNames.get(String(c.programme_id)) ?? ''
		})),
		applications: applications.status === 'fulfilled'
			? applications.value.map((a) => ({
					id: idOf(APPLICATION, a),
					call: callTitles.get(String(a.call_id)) ?? String(a.call_id),
					startup_name: String(a.startup_name ?? ''),
					status: String(a.status ?? ''),
					eligibility: String(a.eligibility ?? ''),
					submitted_at: String(a.submitted_at ?? ''),
					decision: String(latestDecision(idOf(APPLICATION, a), decisionList)?.decision ?? '')
				}))
			: [],
		space: access?.space ?? '',
		roles,
		entitlementRequestsUrl: access?.entitlementRequestsUrl ?? null,
		errors: {
			programmes: programmes.status === 'rejected' ? messageOf(programmes.reason) : null,
			calls: calls.status === 'rejected' ? messageOf(calls.reason) : null,
			applications: applications.status === 'rejected' ? messageOf(applications.reason) : null
		}
	};
};

export const actions: Actions = {
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!),
	createProgramme: async ({ locals, request }) => {
		const record = readProgrammeForm(await request.formData());
		if (!record.name) return fail(400, { form: 'programme', error: 'name' });
		return write('programme', () => createRecord(PROGRAMME, '', record, userToken(locals)!), { created: true });
	},
	createCall: async ({ locals, request }) => {
		const record = readCallForm(await request.formData());
		if (!record.programme_id || !record.title) return fail(400, { form: 'call', error: 'title' });
		return write('call', () => createRecord(CALL, '', record, userToken(locals)!), { created: true });
	}
};
