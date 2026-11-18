/*
 * Copyright (C) 2026 TESOBE GmbH
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
import { createRecord, idOf, userToken, type EntityRecord } from '$lib/server/records';
import {
	APPEAL,
	APPEAL_DECISION,
	APPROVAL,
	ASSESSMENT,
	EVIDENCE,
	REPORT,
	RESULT,
	REVIEW_ASSIGNMENT,
	WAIVER_DECISION,
	WAIVER_REQUEST
} from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { attachFile, uploadProblem } from '$lib/server/files';
import { issueReport, reportSigner } from '$lib/server/reports';
import { roleCheck } from '$lib/server/staffAccess';
import { spaceName, spaceParam } from '$lib/server/spaces';
import { centralSpace } from '$lib/server/space';
import { loadSubmission, type LoadedSubmission } from '$lib/server/submissions';
import { mayApprove } from '$lib/review';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

const create = (e: string) => `CanCreateDynamicEntityRecord_${e}`;

/** Today, YYYY-MM-DD. */
const today = () => new Date().toISOString().slice(0, 10);

export const load: PageServerLoad = async ({ locals, params }) => {
	const space = spaceParam(params.spaceId);
	const token = userToken(locals)!;
	const [s, name, can] = await Promise.all([loadSubmission(space, params.submissionId, token), spaceName(space, token), roleCheck(token)]);
	const me = locals.session.data.user?.user_id ?? '';
	const at = (role: string) => can(role, space);
	const latestApproval = s.approvals.at(-1) ?? null;
	const { signer, problem: signingProblem } = reportSigner();
	return {
		space,
		centralSpace: centralSpace(),
		name,
		...s,
		me,
		latestApproval,
		signingReady: signer !== null,
		signingProblem,
		can: {
			addEvidence: at(create(EVIDENCE)) && at('CanCreateFileAtOneBank'),
			requestWaiver: at(create(WAIVER_REQUEST)),
			appeal: at(create(APPEAL)),
			assign: at(create(REVIEW_ASSIGNMENT)),
			assess: at(create(ASSESSMENT)),
			decideWaiver: at(create(WAIVER_DECISION)),
			decideAppeal: at(create(APPEAL_DECISION)),
			approve: at(create(APPROVAL)) && can(create(REPORT)),
			approveWithoutReport: at(create(APPROVAL)) && !can(create(REPORT)),
			// Separation of duties: whoever assessed a test of this submission does not approve it.
			approveAsMe: mayApprove(me, s.assessments)
		}
	};
};

/** The submission and the User's token, for an action. */
async function context(event: RequestEvent) {
	const space = spaceParam(event.params.spaceId);
	const token = userToken(event.locals)!;
	return { space, token, s: await loadSubmission(space, event.params.submissionId, token), form: await event.request.formData() };
}

const text = (form: FormData, name: string, max = 4000) => String(form.get(name) ?? '').trim().slice(0, max);

/** A test of this submission's suite, by test ID. */
const testOf = (s: LoadedSubmission, testId: string) => s.tests.find((t) => t.test_id === testId);

async function record(entity: string, body: EntityRecord, token: string, space: string, done: Record<string, unknown>) {
	try {
		await createRecord(entity, body, token, { space });
	} catch (err) {
		return fail(400, { problem: messageOf(err) });
	}
	return done;
}

export const actions: Actions = {
	addEvidence: async (event) => {
		const { space, token, s, form } = await context(event);
		const testId = text(form, 'test_id', 64);
		const note = text(form, 'note');
		const file = form.get('file');
		const test = testOf(s, testId);
		if (!test || test.kind === 'automated') return fail(400, { problem: 'Choose an evidence or control test of this suite.' });
		if (!note) return fail(400, { problem: 'Say what the evidence shows.' });
		const upload = file instanceof File && file.size > 0 ? file : null;
		const problem = upload ? uploadProblem(upload) : null;
		if (problem) return fail(400, { problem });
		let evidence: EntityRecord;
		try {
			evidence = await createRecord(EVIDENCE, { submission_id: event.params.submissionId, test_id: testId, note }, token, { space });
			if (upload) await attachFile(space, EVIDENCE, idOf(EVIDENCE, evidence), upload, token);
		} catch (err) {
			return fail(400, { problem: messageOf(err) });
		}
		return { done: `Evidence added for ${testId}.` };
	},

	requestWaiver: async (event) => {
		const { space, token, s, form } = await context(event);
		const testId = text(form, 'test_id', 64);
		const reason = text(form, 'reason');
		const until = text(form, 'requested_until', 10);
		if (!testOf(s, testId)) return fail(400, { problem: 'Choose a test of this suite.' });
		if (!reason) return fail(400, { problem: 'Say why the test should be waived.' });
		if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || until <= today()) return fail(400, { problem: 'Give a date in the future that the waiver is wanted until.' });
		return record(WAIVER_REQUEST, { submission_id: event.params.submissionId, test_id: testId, reason, requested_until: until }, token, space, { done: `Waiver asked for ${testId}.` });
	},

	appeal: async (event) => {
		const { space, token, s, form } = await context(event);
		const [aboutEntity, aboutId] = text(form, 'about', 200).split(':');
		const reason = text(form, 'reason');
		const known =
			(aboutEntity === RESULT && s.results.some((r) => idOf(RESULT, r) === aboutId)) ||
			(aboutEntity === ASSESSMENT && s.assessments.some((a) => idOf(ASSESSMENT, a) === aboutId)) ||
			(aboutEntity === APPROVAL && s.approvals.some((a) => idOf(APPROVAL, a) === aboutId));
		if (!known) return fail(400, { problem: 'Choose a result, assessment or decision of this submission to appeal.' });
		if (!reason) return fail(400, { problem: 'Say why it is wrong.' });
		return record(APPEAL, { about_entity: aboutEntity, about_id: aboutId, reason }, token, space, { done: 'Appeal made. The original stays as it was until the appeal is decided.' });
	},

	assignMe: async (event) => {
		const { space, token, s } = await context(event);
		const me = event.locals.session.data.user?.user_id ?? '';
		if (s.assignments.some((a) => a.reviewer_user_id === me)) return { done: 'You are already a reviewer of this submission.' };
		return record(REVIEW_ASSIGNMENT, { submission_id: event.params.submissionId, reviewer_user_id: me }, token, space, { done: 'You are now a reviewer of this submission.' });
	},

	assess: async (event) => {
		const { space, token, s, form } = await context(event);
		const testId = text(form, 'test_id', 64);
		const outcome = text(form, 'outcome', 16);
		const reason = text(form, 'reason');
		const test = testOf(s, testId);
		if (!test) return fail(400, { problem: 'Choose a test of this suite.' });
		if (!['pass', 'fail', 'not_applicable'].includes(outcome)) return fail(400, { problem: 'Choose pass, fail or not applicable.' });
		if (!s.open) return fail(400, { problem: 'This submission is already decided.' });
		if (!reason) return fail(400, { problem: 'Give the reason for your assessment.' });
		if (test.kind === 'automated') {
			const row = s.rows.find((r) => r.test_id === testId);
			const result = s.results.filter((r) => r.test_id === testId).map((r) => idOf(RESULT, r));
			const upheld = s.appeals.some(
				(a) => a.about_entity === RESULT && result.includes(String(a.about_id)) && s.appealDecisions.some((d) => d.appeal_id === idOf(APPEAL, a) && d.upheld === true)
			);
			if (!upheld) return fail(400, { problem: `${testId} is automated. Its result stands unless an appeal about it is upheld${row?.outcome === 'fail' ? '; a waiver can let approval go ahead' : ''}.` });
		}
		return record(ASSESSMENT, { submission_id: event.params.submissionId, test_id: testId, outcome, reason }, token, space, { done: `Assessment of ${testId} recorded.` });
	},

	decideWaiver: async (event) => {
		const { space, token, s, form } = await context(event);
		const requestId = text(form, 'waiver_request_id', 64);
		const approved = text(form, 'approved', 8) === 'yes';
		const expires = text(form, 'expires_on', 10);
		const reason = text(form, 'reason');
		if (!s.waiverRequests.some((w) => idOf(WAIVER_REQUEST, w) === requestId)) return fail(400, { problem: 'Choose a waiver request of this submission.' });
		if (!reason) return fail(400, { problem: 'Give the reason for the decision.' });
		if (approved && (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || expires <= today())) return fail(400, { problem: 'An approved waiver needs an end date in the future.' });
		return record(WAIVER_DECISION, { waiver_request_id: requestId, approved, expires_on: approved ? expires : '', reason }, token, space, { done: approved ? `Waiver approved until ${expires}.` : 'Waiver refused.' });
	},

	decideAppeal: async (event) => {
		const { space, token, s, form } = await context(event);
		const appealId = text(form, 'appeal_id', 64);
		const upheld = text(form, 'upheld', 8) === 'yes';
		const reason = text(form, 'reason');
		if (!s.appeals.some((a) => idOf(APPEAL, a) === appealId)) return fail(400, { problem: 'Choose an appeal of this submission.' });
		if (!reason) return fail(400, { problem: 'Give the reason for the decision.' });
		return record(APPEAL_DECISION, { appeal_id: appealId, upheld, reason }, token, space, { done: upheld ? 'Appeal upheld. A reviewer can now assess the test again.' : 'Appeal not upheld.' });
	},

	decide: async (event) => {
		const { space, token, s, form } = await context(event);
		const approved = text(form, 'approved', 8) === 'yes';
		const reason = text(form, 'reason');
		const me = event.locals.session.data.user?.user_id ?? '';
		if (!reason) return fail(400, { problem: 'Give the reason for the decision.' });
		if (!s.open) return fail(400, { problem: 'This submission is already decided. Only an upheld appeal about a refusal opens it again.' });
		if (!mayApprove(me, s.assessments)) return fail(400, { problem: 'You assessed tests of this submission, so another person must make the final decision.' });
		if (approved) {
			if (s.blockers.length) return fail(400, { problem: `It cannot be approved yet: ${s.blockers.join(' ')}` });
			const { signer, problem } = reportSigner();
			if (!signer) return fail(400, { problem: `It cannot be approved: ${problem}` });
		}
		let approval: EntityRecord;
		try {
			approval = await createRecord(APPROVAL, { submission_id: event.params.submissionId, approved, reason }, token, { space });
		} catch (err) {
			return fail(400, { problem: messageOf(err) });
		}
		if (!approved) return { done: 'The submission is refused. The participant can fix what failed and submit a new run.' };
		try {
			const reference = await issueReport(space, s, { ...approval, created_by: me }, token);
			return { done: `Approved. Report ${reference} is issued.`, reference };
		} catch (err) {
			return fail(400, { problem: `Approved, but the report could not be issued: ${messageOf(err)} Issue it from this page once that is fixed.` });
		}
	},

	issueReport: async (event) => {
		const { space, token, s } = await context(event);
		const approval = s.approvals.at(-1);
		if (!approval || approval.approved !== true) return fail(400, { problem: 'Only an approved submission gets a report.' });
		if (s.reports.length) return fail(400, { problem: `This submission already has report ${s.reports[0].reference}.` });
		try {
			const reference = await issueReport(space, s, approval, token);
			return { done: `Report ${reference} is issued.`, reference };
		} catch (err) {
			return fail(400, { problem: `The report could not be issued: ${messageOf(err)}` });
		}
	}
};
