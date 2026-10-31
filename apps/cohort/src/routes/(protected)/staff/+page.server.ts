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
import { APPLICATION, CALL, PROGRAMME } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { createRecord, idOf, listRecords, userToken, type CohortRecord } from '$lib/server/records';
import type { Actions, PageServerLoad } from './$types';

const STATUSES = ['draft', 'open', 'closed'];

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

/** Only the fields that were filled in: empty optional fields are left out of the record. */
function filled(record: Record<string, string>): CohortRecord {
	return Object.fromEntries(Object.entries(record).filter(([, v]) => v !== ''));
}

/**
 * Programmes and calls are read publicly; every application is read through the community URL, which needs
 * CanGetDynamicEntityRecord_cohort_application at Cohort's space. A section the User may not read shows OBP's
 * reason instead.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const token = userToken(locals);
	const [programmes, calls, applications] = await Promise.allSettled([
		listRecords(PROGRAMME, 'public'),
		listRecords(CALL, 'public'),
		listRecords(APPLICATION, 'community', token)
	]);
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
					submitted_at: String(a.submitted_at ?? '')
				}))
			: [],
		errors: {
			programmes: programmes.status === 'rejected' ? messageOf(programmes.reason) : null,
			calls: calls.status === 'rejected' ? messageOf(calls.reason) : null,
			applications: applications.status === 'rejected' ? messageOf(applications.reason) : null
		}
	};
};

export const actions: Actions = {
	createProgramme: async ({ locals, request }) => {
		const form = await request.formData();
		const status = str(form, 'status');
		const record = filled({
			name: str(form, 'name'),
			description: str(form, 'description'),
			status: STATUSES.includes(status) ? status : 'draft',
			starts_on: str(form, 'starts_on'),
			ends_on: str(form, 'ends_on')
		});
		if (!record.name) return fail(400, { form: 'programme', error: 'name' });
		try {
			await createRecord(PROGRAMME, '', record, userToken(locals)!);
		} catch (err) {
			return fail(400, { form: 'programme', error: messageOf(err) });
		}
		return { form: 'programme', created: true };
	},
	createCall: async ({ locals, request }) => {
		const form = await request.formData();
		const status = str(form, 'status');
		const record = filled({
			programme_id: str(form, 'programme_id'),
			title: str(form, 'title'),
			description: str(form, 'description'),
			status: STATUSES.includes(status) ? status : 'draft',
			opens_at: str(form, 'opens_at'),
			closes_at: str(form, 'closes_at')
		});
		if (!record.programme_id || !record.title) return fail(400, { form: 'call', error: 'title' });
		try {
			await createRecord(CALL, '', record, userToken(locals)!);
		} catch (err) {
			return fail(400, { form: 'call', error: messageOf(err) });
		}
		return { form: 'call', created: true };
	}
};
