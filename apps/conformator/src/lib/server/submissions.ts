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
import { error } from '@sveltejs/kit';
import { getRecord, idOf, listRecords, type EntityRecord } from './records';
import {
	APPEAL,
	APPEAL_DECISION,
	APPROVAL,
	ASSESSMENT,
	EVIDENCE,
	REPORT,
	RESULT,
	REVIEW_ASSIGNMENT,
	SUBMISSION,
	SYSTEM,
	WAIVER_DECISION,
	WAIVER_REQUEST
} from './entities/definitions';
import { loadSuite } from './catalogue';
import { messageOf } from './errors';
import { filesOf } from './files';
import { approvalBlockers, reopened, reviewedOutcomes, submissionStatus } from '$lib/review';

/** A record with who made it and when, from its metadata, as the review rules need. */
async function withAuthors(entity: string, space: string, token: string, filter: (r: EntityRecord) => boolean): Promise<EntityRecord[]> {
	try {
		return (await listRecords(entity, token, { space }))
			.filter(({ record }) => filter(record))
			.map(({ record, metadata }): EntityRecord => ({ ...record, created_at: metadata.created?.at ?? null, created_by: metadata.created?.user_id ?? null }))
			.sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
	} catch {
		// Without the Get Role the section is shown as unreadable rather than empty.
		return [];
	}
}

/** The run ids a submission counts, from the JSON list it stores. */
export function runIdsOf(submission: EntityRecord): string[] {
	try {
		const value = JSON.parse(String(submission.run_ids ?? '[]'));
		return Array.isArray(value) ? value.map(String) : [];
	} catch {
		return [];
	}
}

/**
 * Everything about one submission, read with the User's own Roles: the system and suite, the results of its runs,
 * evidence and its files, assessments, waivers, appeals, approvals and reports, and the outcome of each test after
 * review. Sections the User cannot read come back empty.
 */
export async function loadSubmission(space: string, submissionId: string, token: string) {
	let submission: EntityRecord;
	let submittedBy: string | null = null;
	try {
		const got = await getRecord(SUBMISSION, submissionId, token, { space });
		submission = got.record;
		submittedBy = got.metadata.created?.user_id ?? null;
	} catch (err) {
		error(404, `The submission could not be read: ${messageOf(err)}`);
	}
	const runIds = runIdsOf(submission);
	const ofThis = (r: EntityRecord) => r.submission_id === submissionId;
	const [system, catalogue, results, evidence, assessments, waiverRequests, appeals, assignments, approvals] = await Promise.all([
		getRecord(SYSTEM, String(submission.system_id), token, { space }).then((r) => r.record).catch(() => null),
		loadSuite(String(submission.suite_id)).catch(() => null),
		withAuthors(RESULT, space, token, (r) => runIds.includes(String(r.run_id))),
		withAuthors(EVIDENCE, space, token, ofThis),
		withAuthors(ASSESSMENT, space, token, ofThis),
		withAuthors(WAIVER_REQUEST, space, token, ofThis),
		withAuthors(APPEAL, space, token, () => true),
		withAuthors(REVIEW_ASSIGNMENT, space, token, ofThis),
		withAuthors(APPROVAL, space, token, ofThis)
	]);
	const waiverIds = new Set(waiverRequests.map((w) => idOf(WAIVER_REQUEST, w)));
	const resultIds = new Set(results.map((r) => idOf(RESULT, r)));
	const assessmentIds = new Set(assessments.map((a) => idOf(ASSESSMENT, a)));
	const approvalIds = new Set(approvals.map((a) => idOf(APPROVAL, a)));
	// Appeals about this submission: about one of its results, assessments or approvals.
	const ownAppeals = appeals.filter(
		(a) =>
			(a.about_entity === RESULT && resultIds.has(String(a.about_id))) ||
			(a.about_entity === ASSESSMENT && assessmentIds.has(String(a.about_id))) ||
			(a.about_entity === APPROVAL && approvalIds.has(String(a.about_id)))
	);
	const appealIds = new Set(ownAppeals.map((a) => idOf(APPEAL, a)));
	const [waiverDecisions, appealDecisions, evidenceFiles, reports] = await Promise.all([
		withAuthors(WAIVER_DECISION, space, token, (d) => waiverIds.has(String(d.waiver_request_id))),
		withAuthors(APPEAL_DECISION, space, token, (d) => appealIds.has(String(d.appeal_id))),
		Promise.all(evidence.map((e) => filesOf(space, EVIDENCE, idOf(EVIDENCE, e), token).catch(() => []))),
		listRecords(REPORT, undefined, { access: 'public' })
			.then((list) => list.map((r) => r.record).filter((r) => r.submission_id === submissionId))
			.catch(() => [])
	]);

	const tests = catalogue?.tests ?? [];
	const rows = reviewedOutcomes({
		tests,
		results: results.map((r) => ({ ...r, run_order: runIds.indexOf(String(r.run_id)) })),
		assessments,
		waiverRequests,
		waiverDecisions,
		appeals: ownAppeals,
		appealDecisions,
		today: new Date().toISOString().slice(0, 10)
	});
	return {
		submission,
		submittedBy,
		runIds,
		system,
		suite: catalogue?.suite ?? null,
		tests,
		results,
		rows,
		blockers: approvalBlockers(rows),
		status: submissionStatus(approvals, assignments),
		// Decided and final, unless an appeal about a refusal was upheld.
		open: approvals.length === 0 || reopened(approvals, ownAppeals, appealDecisions),
		evidence: evidence.map((e, i): EntityRecord => ({ ...e, files: evidenceFiles[i] })),
		assessments,
		waiverRequests,
		waiverDecisions,
		appeals: ownAppeals,
		appealDecisions,
		assignments,
		approvals,
		reports
	};
}

export type LoadedSubmission = Awaited<ReturnType<typeof loadSubmission>>;
