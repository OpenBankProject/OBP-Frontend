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
/**
 * The rules of review: what each test's outcome is once a submission has been reviewed, what stops approval, and where
 * a submission stands. Pure functions over records, so the rules are tested apart from OBP-API.
 *
 * The rules, from the regulator's requirements:
 * - An automated test's outcome is its result in the submission's latest run that has it. A reviewer cannot override
 *   it, except after an appeal about that result is upheld: then the reviewer's later assessment counts.
 * - An evidence or control test's outcome is the reviewer's latest assessment; until then it is not executed.
 * - A waiver never changes an outcome. An approved, unexpired waiver lets approval go ahead despite that test, and is
 *   shown wherever the outcome is.
 */

export type Effective = 'pass' | 'fail' | 'blocked' | 'not_executed' | 'not_applicable';

export interface Rec {
	[k: string]: unknown;
	/** When the record was created (from its metadata), to find the latest. */
	created_at?: string | null;
}

export interface ReviewInput {
	tests: Rec[];
	/** The results of the submission's runs, each with its run's position in run_ids (later runs win). */
	results: Array<Rec & { run_order: number }>;
	assessments: Rec[];
	waiverRequests: Rec[];
	waiverDecisions: Rec[];
	appeals: Rec[];
	appealDecisions: Rec[];
	/** Today, YYYY-MM-DD, for waiver expiry. */
	today: string;
}

export interface TestRow {
	test_id: string;
	mandatory: boolean;
	kind: string;
	outcome: Effective;
	/** Where the outcome comes from: the runner, or a reviewer's assessment. */
	source: 'run' | 'assessment' | 'none';
	/** The result record the outcome comes from, if any (for appeals). */
	result_id: string | null;
	/** The assessment the outcome comes from, if any. */
	assessment_id: string | null;
	waiver: { expires_on: string; reason: string } | null;
}

const OUTCOME_WORDS = ['pass', 'fail', 'blocked', 'not_executed', 'not_applicable'];

const latest = <T extends Rec>(list: T[]): T | undefined =>
	list.reduce<T | undefined>((a, b) => (!a || String(b.created_at ?? '') >= String(a.created_at ?? '') ? b : a), undefined);

function asOutcome(value: unknown): Effective {
	return (OUTCOME_WORDS.includes(String(value)) ? value : 'not_executed') as Effective;
}

/** Each test's outcome after review, in the tests' order. */
export function reviewedOutcomes(input: ReviewInput): TestRow[] {
	return input.tests.map((test) => {
		const id = String(test.test_id);
		const assessment = latest(input.assessments.filter((a) => a.test_id === id));
		const result = input.results
			.filter((r) => r.test_id === id)
			.reduce<(Rec & { run_order: number }) | undefined>((a, b) => (!a || b.run_order >= a.run_order ? b : a), undefined);
		const resultId = result ? String(result.conformator_result_id ?? '') : null;

		let outcome: Effective;
		let source: TestRow['source'];
		if (test.kind === 'automated') {
			const appeal = resultId ? input.appeals.filter((a) => a.about_entity === 'conformator_result' && a.about_id === resultId) : [];
			const upheld = appeal.some((a) =>
				input.appealDecisions.some((d) => d.appeal_id === a.conformator_appeal_id && d.upheld === true)
			);
			const upheldAt = upheld
				? String(latest(input.appealDecisions.filter((d) => appeal.some((a) => a.conformator_appeal_id === d.appeal_id) && d.upheld === true))?.created_at ?? '')
				: '';
			if (upheld && assessment && String(assessment.created_at ?? '') >= upheldAt) {
				outcome = asOutcome(assessment.outcome);
				source = 'assessment';
			} else if (result) {
				outcome = asOutcome(result.outcome);
				source = 'run';
			} else {
				outcome = 'not_executed';
				source = 'none';
			}
		} else if (assessment) {
			outcome = asOutcome(assessment.outcome);
			source = 'assessment';
		} else {
			outcome = 'not_executed';
			source = 'none';
		}

		const waiver = input.waiverRequests
			.filter((w) => w.test_id === id)
			.map((w) => latest(input.waiverDecisions.filter((d) => d.waiver_request_id === w.conformator_waiver_request_id)))
			.find((d) => d && d.approved === true && String(d.expires_on ?? '') >= input.today);

		return {
			test_id: id,
			mandatory: test.mandatory === true,
			kind: String(test.kind),
			outcome,
			source,
			result_id: source === 'run' ? resultId : null,
			assessment_id: source === 'assessment' && assessment ? String(assessment.conformator_assessment_id ?? '') : null,
			waiver: waiver ? { expires_on: String(waiver.expires_on), reason: String(waiver.reason ?? '') } : null
		};
	});
}

/**
 * Why a submission cannot be approved yet: a mandatory test that failed, or has no pass or fail, without an approved
 * waiver. Empty when it can be. Refusing a submission is always possible.
 */
export function approvalBlockers(rows: TestRow[]): string[] {
	return rows
		.filter((r) => r.mandatory && !r.waiver && r.outcome !== 'pass' && r.outcome !== 'not_applicable')
		.map((r) => (r.outcome === 'fail' ? `${r.test_id} failed.` : `${r.test_id} has no pass or fail yet.`));
}

export type SubmissionStatus = 'submitted' | 'under_review' | 'approved' | 'refused';

/** Where a submission stands: the latest approval decides; before one, an assigned reviewer means under review. */
export function submissionStatus(approvals: Rec[], assignments: Rec[]): SubmissionStatus {
	const decision = latest(approvals);
	if (decision) return decision.approved === true ? 'approved' : 'refused';
	return assignments.length ? 'under_review' : 'submitted';
}

/**
 * Whether a User may approve: never someone who assessed a test of this submission, so whoever reviewed the evidence
 * is not also the one who approves it.
 */
export function mayApprove(userId: string, assessments: Rec[]): boolean {
	return !assessments.some((a) => a.created_by === userId);
}

/**
 * Whether a decided submission is open again: its latest decision was a refusal, and an appeal about that refusal was
 * upheld. Then reviewers may assess again and an approver decide again; otherwise a decision is final.
 */
export function reopened(approvals: Rec[], appeals: Rec[], appealDecisions: Rec[]): boolean {
	const decision = latest(approvals);
	if (!decision || decision.approved === true) return false;
	const id = String(decision.conformator_approval_id ?? '');
	return appeals.some(
		(a) => a.about_entity === 'conformator_approval' && a.about_id === id && appealDecisions.some((d) => d.appeal_id === a.conformator_appeal_id && d.upheld === true)
	);
}
