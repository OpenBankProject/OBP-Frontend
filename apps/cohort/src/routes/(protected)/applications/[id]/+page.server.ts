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
import { answersOf, missingAnswers, readAnswers, type Form } from '$lib/forms';
import { applicantMayEdit, latestDecision, nowUtc } from '$lib/screening';
import { decisionsAsCohort, forApplicant } from '$lib/server/decisions';
import { MAX_UPLOAD_BYTES, UPLOAD_MEDIA_TYPES, filesOfApplication, uploadApplicationFile } from '$lib/server/files';
import { messageOf } from '$lib/server/errors';
import { APPLICATION, CALL } from '$lib/server/entities/definitions';
import { getRecord, updateRecord, userToken } from '$lib/server/records';
import { submittedEmail } from '$lib/emails';
import { myCustomer } from '$lib/server/customers';
import { emailCustomer, pageUrl } from '$lib/server/notify';
import { applicationFormOf, listForms, myAnswers, writeMyAnswers } from '$lib/server/forms';
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

/**
 * The call's extra questions from the form builder: the form this application already answered, else the call's
 * published application form, else none.
 */
async function extraForm(application: Record<string, unknown>): Promise<Form | null> {
	const forms = await listForms().catch(() => []);
	const answered = forms.find((f) => f.id === String(application.form_id ?? '') && f.status !== 'draft');
	return answered ?? applicationFormOf(String(application.call_id), forms);
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const token = userToken(locals)!;
	const application = await myApplication(params.id, token);
	const [call, latest, files, form] = await Promise.all([
		getRecord(CALL, 'public', String(application.call_id)).catch(() => null),
		latestFor(params.id),
		filesOfApplication(params.id, token).catch(() => []),
		extraForm(application)
	]);
	const editable = applicantMayEdit(application, latest);
	// A form published after this application was submitted was never asked of it.
	const asked = form && (application.form_id || editable) ? form : null;
	const mine = asked ? await myAnswers(asked, params.id, token).catch(() => null) : null;
	return {
		extra: asked ? { questions: asked.questions, answers: answersOf(asked.questions, mine?.record) } : null,
		files,
		uploadAccept: Object.values(UPLOAD_MEDIA_TYPES).join(','),
		maxUploadBytes: MAX_UPLOAD_BYTES,
		application,
		callTitle: call ? String(call.title ?? '') : String(application.call_id),
		outcome: forApplicant(latest),
		editable
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
		const data = await request.formData();
		const values = readApplicationForm(data);
		const form = await extraForm(application);
		try {
			if (form) await writeMyAnswers(form, params.id, String(values.startup_name ?? ''), readAnswers(form.questions, data), false, token);
		} catch (err) {
			return fail(400, { answersError: messageOf(err) });
		}
		await updateRecord(APPLICATION, 'my', params.id, { call_id: application.call_id, customer_id: application.customer_id, ...(form ? { form_id: form.id } : {}), status: 'draft', ...values }, token);
		return { saved: true };
	},
	submit: async ({ params, locals, request }) => {
		const token = userToken(locals)!;
		const application = await myApplication(params.id, token);
		if (!applicantMayEdit(application, await latestFor(params.id))) return fail(400, { submitted: true });
		const data = await request.formData();
		const values = readApplicationForm(data);
		const form = await extraForm(application);
		const answers = form ? readAnswers(form.questions, data) : {};
		const missing = missingToSubmit(values);
		const missingQuestions = form ? missingAnswers(form.questions, answers).map((q) => q.key) : [];
		const formId = form ? { form_id: form.id } : {};
		try {
			// The answers are written first, so a submitted application always has them.
			if (form) await writeMyAnswers(form, params.id, String(values.startup_name ?? ''), answers, missing.length === 0 && missingQuestions.length === 0, token);
		} catch (err) {
			return fail(400, { answersError: messageOf(err) });
		}
		if (missing.length > 0 || missingQuestions.length > 0) {
			// Keep what was typed: save it as a draft, and say what is still missing.
			await updateRecord(APPLICATION, 'my', params.id, { call_id: application.call_id, customer_id: application.customer_id, ...formId, status: 'draft', ...values }, token);
			return fail(400, { missing, missingQuestions });
		}
		await updateRecord(APPLICATION, 'my', params.id, {
			call_id: application.call_id,
			customer_id: application.customer_id,
			...formId,
			...values,
			status: 'submitted',
			eligibility: eligibilityOf(values),
			submitted_at: nowUtc()
		}, token);
		const call = await getRecord(CALL, 'public', String(application.call_id)).catch(() => null);
		// Applications started before applicants became Customers have no customer_id; theirs is looked up.
		const customerId =
			String(application.customer_id ?? '') || (await myCustomer(token).catch(() => null))?.customer_id || '';
		await emailCustomer(
			customerId,
			submittedEmail({
				site: locals.branding.name || 'Cohort',
				call: String(call?.title ?? ''),
				startup: String(values.startup_name ?? ''),
				link: pageUrl(`/applications/${params.id}`)
			}),
			`${APPLICATION}:${params.id}`
		);
		return { submittedNow: true };
	}
};
