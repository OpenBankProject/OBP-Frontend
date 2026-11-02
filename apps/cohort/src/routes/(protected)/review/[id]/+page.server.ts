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
import { error, fail, redirect } from '@sveltejs/kit';
import { APPLICATION_FIELDS } from '$lib/applications';
import { totalScore } from '$lib/evaluation';
import { nowUtc } from '$lib/screening';
import { APPLICATION, CALL, REVIEW, REVIEW_ASSIGNMENT } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { assignmentOf, reviews, rubricOf, standingOf } from '$lib/server/evaluation';
import { createRecord, getRecord, userToken } from '$lib/server/records';
import { answersOnApplication } from '$lib/server/forms';
import { requestRole } from '$lib/server/staffRecords';
import { cohortSpace } from '$lib/server/space';
import type { Actions, PageServerLoad } from './$types';

/** The assignment, only for its own reviewer, and only while staff have accepted their offer to review. */
async function myAssignment(id: string, locals: App.Locals) {
	if ((await standingOf(locals.session.data.user?.user_id ?? '')) !== 'accepted') error(403, 'Your offer to review has not been accepted.');
	const record = await getRecord(REVIEW_ASSIGNMENT, '', id, userToken(locals)).catch((err) => {
		const message = messageOf(err);
		error(/OBP-20006|missing/i.test(message) ? 403 : 404, message);
	});
	const assignment = assignmentOf(record);
	if (assignment.reviewer_user_id !== locals.session.data.user?.user_id) error(403, 'This review is assigned to someone else.');
	return assignment;
}

/**
 * Reviewing one application. The reviewer first declares whether they have a conflict of interest; the application is
 * shown only once they declare none. Then they score each criterion of the rubric and add comments. A review is
 * submitted once.
 */
export const load: PageServerLoad = async ({ params, locals, url }) => {
	const token = userToken(locals)!;
	const assignment = await myAssignment(params.id, locals);
	const [existing, rubric, call] = await Promise.all([
		reviews(token, 'my').then((all) => all.find((r) => r.assignment_id === assignment.id) ?? null),
		rubricOf(assignment.call_id),
		getRecord(CALL, 'public', assignment.call_id).catch(() => null)
	]);
	const declaredNone = url.searchParams.get('declared') === 'none';
	const showApplication = !existing && declaredNone;
	const application = showApplication
		? await getRecord(APPLICATION, 'community', assignment.application_id, token).catch((err) => error(403, messageOf(err)))
		: null;
	const extra = application ? await answersOnApplication(application, assignment.application_id, token).catch(() => null) : null;
	return {
		extra,
		space: cohortSpace(),
		assignment,
		callTitle: String(call?.title ?? ''),
		existing,
		rubric,
		step: existing ? 'done' : declaredNone ? 'score' : 'declare',
		application,
		fields: APPLICATION_FIELDS.map((f) => ({ key: f.key, kind: f.kind }))
	};
};

export const actions: Actions = {
	noConflict: async ({ params }) => redirect(303, `/review/${params.id}?declared=none`),
	/** Ask for the Get Role on the answers to the call's extra questions. */
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!),
	conflict: async ({ params, locals, request }) => {
		const token = userToken(locals)!;
		const assignment = await myAssignment(params.id, locals);
		const note = String((await request.formData()).get('conflict_note') ?? '').trim();
		if (!note) return fail(400, { error: 'conflict_note' });
		await createRecord(REVIEW, 'my', {
			assignment_id: assignment.id,
			application_id: assignment.application_id,
			call_id: assignment.call_id,
			conflict_of_interest: true,
			conflict_note: note,
			submitted_at: nowUtc()
		}, token);
		redirect(303, `/review/${params.id}`);
	},
	submit: async ({ params, locals, request }) => {
		const token = userToken(locals)!;
		const assignment = await myAssignment(params.id, locals);
		if ((await reviews(token, 'my')).some((r) => r.assignment_id === assignment.id)) redirect(303, `/review/${params.id}`);
		const form = await request.formData();
		const rubric = await rubricOf(assignment.call_id);
		const scores = Object.fromEntries(rubric.map((c) => [c.id, Math.trunc(Number(form.get(`score_${c.id}`)))]));
		const total = totalScore(rubric, scores);
		if (total === null) return fail(400, { error: 'scores' });
		await createRecord(REVIEW, 'my', {
			assignment_id: assignment.id,
			application_id: assignment.application_id,
			call_id: assignment.call_id,
			conflict_of_interest: false,
			scores_json: JSON.stringify(scores),
			total_score: total,
			comments: String(form.get('comments') ?? '').trim(),
			submitted_at: nowUtc()
		}, token);
		redirect(303, `/review/${params.id}`);
	}
};
