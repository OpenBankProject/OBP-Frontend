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
import { applicantMayEdit, latestDecision, nowUtc } from '$lib/screening';
import { decisionsAsCohort, forApplicant } from '$lib/server/decisions';
import { MAX_UPLOAD_BYTES, UPLOAD_MEDIA_TYPES, filesOfApplication, uploadApplicationFile } from '$lib/server/files';
import { messageOf } from '$lib/server/errors';
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

/** The newest decision on this application, read as Cohort itself, since the applicant holds no Role. */
async function latestFor(id: string) {
	return latestDecision(id, await decisionsAsCohort());
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const application = await myApplication(params.id, userToken(locals));
	const [call, latest, files] = await Promise.all([
		getRecord(CALL, 'public', String(application.call_id)).catch(() => null),
		latestFor(params.id),
		filesOfApplication(params.id, userToken(locals)!).catch(() => [])
	]);
	return {
		files,
		uploadAccept: Object.values(UPLOAD_MEDIA_TYPES).join(','),
		maxUploadBytes: MAX_UPLOAD_BYTES,
		application,
		callTitle: call ? String(call.title ?? '') : String(application.call_id),
		outcome: forApplicant(latest),
		editable: applicantMayEdit(application, latest)
	};
};

export const actions: Actions = {
	upload: async ({ params, locals, request }) => {
		const token = userToken(locals)!;
		const application = await myApplication(params.id, token);
		if (!applicantMayEdit(application, await latestFor(params.id))) return fail(400, { submitted: true });
		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || file.size === 0) return fail(400, { uploadError: 'empty' });
		if (!(file.type in UPLOAD_MEDIA_TYPES)) return fail(400, { uploadError: 'type' });
		if (file.size > MAX_UPLOAD_BYTES) return fail(400, { uploadError: 'size' });
		try {
			await uploadApplicationFile(params.id, file, token);
		} catch (err) {
			return fail(400, { uploadError: messageOf(err) });
		}
		return { uploaded: file.name };
	},
	save: async ({ params, locals, request }) => {
		const token = userToken(locals)!;
		const application = await myApplication(params.id, token);
		if (!applicantMayEdit(application, await latestFor(params.id))) return fail(400, { submitted: true });
		const values = readApplicationForm(await request.formData());
		await updateRecord(APPLICATION, 'my', params.id, { call_id: application.call_id, status: 'draft', ...values }, token);
		return { saved: true };
	},
	submit: async ({ params, locals, request }) => {
		const token = userToken(locals)!;
		const application = await myApplication(params.id, token);
		if (!applicantMayEdit(application, await latestFor(params.id))) return fail(400, { submitted: true });
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
			submitted_at: nowUtc()
		}, token);
		return { submittedNow: true };
	}
};
