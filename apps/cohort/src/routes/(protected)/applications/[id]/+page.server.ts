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
import { error, fail } from '@sveltejs/kit';
import { eligibilityOf, missingToSubmit, readApplicationForm } from '$lib/applications';
import { APPLICATION, CALL } from '$lib/server/entities/definitions';
import { getRecord, updateRecord, userToken } from '$lib/server/records';
import type { Actions, PageServerLoad } from './$types';

/** The caller's own application: the 'my' URL only finds records the caller owns. */
async function myApplication(id: string, token: string | undefined) {
	try {
		return await getRecord(APPLICATION, 'my', id, token);
	} catch {
		error(404, 'Application not found');
	}
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const application = await myApplication(params.id, userToken(locals));
	const call = await getRecord(CALL, 'public', String(application.call_id)).catch(() => null);
	return { application, callTitle: call ? String(call.title ?? '') : String(application.call_id) };
};

export const actions: Actions = {
	save: async ({ params, locals, request }) => {
		const token = userToken(locals)!;
		const application = await myApplication(params.id, token);
		if (application.status === 'submitted') return fail(400, { submitted: true });
		const values = readApplicationForm(await request.formData());
		await updateRecord(APPLICATION, 'my', params.id, { call_id: application.call_id, status: 'draft', ...values }, token);
		return { saved: true };
	},
	submit: async ({ params, locals, request }) => {
		const token = userToken(locals)!;
		const application = await myApplication(params.id, token);
		if (application.status === 'submitted') return fail(400, { submitted: true });
		const values = readApplicationForm(await request.formData());
		const missing = missingToSubmit(values);
		if (missing.length > 0) {
			// Keep what was typed: save it as a draft, and say what is still missing.
			await updateRecord(APPLICATION, 'my', params.id, { call_id: application.call_id, status: 'draft', ...values }, token);
			return fail(400, { missing });
		}
		await updateRecord(APPLICATION, 'my', params.id, {
			call_id: application.call_id,
			...values,
			status: 'submitted',
			eligibility: eligibilityOf(values),
			submitted_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
		}, token);
		return { submittedNow: true };
	}
};
