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
import { error, fail, redirect } from '@sveltejs/kit';
import { createRecord, getRecord, idOf, listRecords, userToken, type EntityRecord } from '$lib/server/records';
import { RESULT, RUN, SUBMISSION, SYSTEM } from '$lib/server/entities/definitions';
import { roleCheck } from '$lib/server/staffAccess';
import { runIdsOf } from '$lib/server/submissions';
import { loadSuite } from '$lib/server/catalogue';
import { messageOf } from '$lib/server/errors';
import { spaceName, spaceParam } from '$lib/server/spaces';
import { summarise } from '$lib/results';
import type { Actions, PageServerLoad } from './$types';

const CREATE_SUBMISSION = `CanCreateDynamicEntityRecord_${SUBMISSION}`;

/** Parse the JSON text kept in a result, or show nothing when it cannot be read. */
function parsed(text: unknown): unknown[] {
	try {
		const value = JSON.parse(String(text ?? '[]'));
		return Array.isArray(value) ? value : [];
	} catch {
		return [];
	}
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const space = spaceParam(params.spaceId);
	const token = userToken(locals)!;
	let run: EntityRecord;
	try {
		run = (await getRecord(RUN, params.runId, token, { space })).record;
	} catch (err) {
		error(404, `The run could not be read: ${messageOf(err)}`);
	}
	const [name, system, catalogue, results, submissions, can] = await Promise.all([
		spaceName(space, token),
		getRecord(SYSTEM, String(run.system_id), token, { space }).then((r) => r.record).catch(() => null),
		loadSuite(String(run.suite_id)).catch(() => null),
		listRecords(RESULT, token, { space }).then((list) => list.map((r) => r.record).filter((r) => r.run_id === params.runId)).catch(() => null),
		listRecords(SUBMISSION, token, { space }).then((list) => list.map((r) => r.record).filter((r) => runIdsOf(r).includes(params.runId))).catch(() => []),
		roleCheck(token)
	]);
	const tests = catalogue?.tests ?? [];
	const byTest = new Map((results ?? []).map((r) => [String(r.test_id), r]));
	return {
		space,
		name,
		run,
		system,
		suite: catalogue?.suite ?? null,
		resultsReadable: results !== null,
		summary: summarise(results ?? [], tests),
		rows: tests.map((test) => {
			const result = byTest.get(String(test.test_id));
			return {
				test_id: String(test.test_id),
				title: String(test.title),
				mandatory: test.mandatory === true,
				suggested_fix: String(test.suggested_fix ?? ''),
				requirements: test.requirements as Array<{ id: string; reference: string; title: string }>,
				result: result
					? {
							outcome: String(result.outcome),
							blocked_by: String(result.blocked_by ?? ''),
							expected: String(result.expected ?? ''),
							actual: String(result.actual ?? ''),
							correlation_ids: parsed(result.correlation_ids).map(String),
							exchanges: JSON.stringify(parsed(result.exchanges), null, 2)
						}
					: null
			};
		}),
		submissions: submissions.map((sub) => ({ id: idOf(SUBMISSION, sub), submitted_at: String(sub.submitted_at ?? '') })),
		canSubmit: run.status === 'finished' && submissions.length === 0 && can(CREATE_SUBMISSION, space),
		// Keep the page fresh until the runner has finished.
		live: run.status === 'queued' || run.status === 'running'
	};
};

export const actions: Actions = {
	/** Put this finished run forward for the regulator's review, as a new submission. */
	submit: async ({ locals, params, request }) => {
		const space = spaceParam(params.spaceId);
		const token = userToken(locals)!;
		const note = String((await request.formData()).get('note') ?? '').trim().slice(0, 4000);
		const run = (await getRecord(RUN, params.runId, token, { space })).record;
		if (run.status !== 'finished') return fail(400, { problem: 'Only a finished run can be submitted.' });
		let submission;
		try {
			submission = await createRecord(
				SUBMISSION,
				{ system_id: String(run.system_id), suite_id: String(run.suite_id), run_ids: JSON.stringify([params.runId]), note, submitted_at: new Date().toISOString() },
				token,
				{ space }
			);
		} catch (err) {
			return fail(400, { problem: messageOf(err) });
		}
		redirect(303, `/spaces/${space}/submissions/${encodeURIComponent(idOf(SUBMISSION, submission))}`);
	}
};
