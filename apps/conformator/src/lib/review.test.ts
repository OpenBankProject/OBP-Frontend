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
import { describe, expect, it } from 'vitest';
import { approvalBlockers, mayApprove, reopened, reviewedOutcomes, submissionStatus, type ReviewInput } from './review';

const tests = [
	{ test_id: 'A-1', kind: 'automated', mandatory: true },
	{ test_id: 'E-1', kind: 'evidence', mandatory: true },
	{ test_id: 'C-1', kind: 'control', mandatory: false }
];

function input(overrides: Partial<ReviewInput> = {}): ReviewInput {
	return { tests, results: [], assessments: [], waiverRequests: [], waiverDecisions: [], appeals: [], appealDecisions: [], today: '2026-11-11', ...overrides };
}

describe('reviewedOutcomes', () => {
	it('takes automated outcomes from the latest run that has the test', () => {
		const rows = reviewedOutcomes(
			input({
				results: [
					{ conformator_result_id: 'r-old', test_id: 'A-1', outcome: 'fail', run_order: 0 },
					{ conformator_result_id: 'r-new', test_id: 'A-1', outcome: 'pass', run_order: 1 }
				]
			})
		);
		expect(rows[0]).toMatchObject({ outcome: 'pass', source: 'run', result_id: 'r-new' });
	});

	it('leaves evidence tests not executed until assessed, then uses the latest assessment', () => {
		expect(reviewedOutcomes(input())[1]).toMatchObject({ outcome: 'not_executed', source: 'none' });
		const rows = reviewedOutcomes(
			input({
				assessments: [
					{ conformator_assessment_id: 'a1', test_id: 'E-1', outcome: 'fail', created_at: '2026-11-01' },
					{ conformator_assessment_id: 'a2', test_id: 'E-1', outcome: 'pass', created_at: '2026-11-02' }
				]
			})
		);
		expect(rows[1]).toMatchObject({ outcome: 'pass', source: 'assessment', assessment_id: 'a2' });
	});

	it('never lets an assessment override an automated failure without an upheld appeal', () => {
		const rows = reviewedOutcomes(
			input({
				results: [{ conformator_result_id: 'r1', test_id: 'A-1', outcome: 'fail', run_order: 0 }],
				assessments: [{ test_id: 'A-1', outcome: 'pass', created_at: '2026-11-05' }],
				appeals: [{ conformator_appeal_id: 'ap1', about_entity: 'conformator_result', about_id: 'r1' }],
				appealDecisions: [{ appeal_id: 'ap1', upheld: false, created_at: '2026-11-04' }]
			})
		);
		expect(rows[0]).toMatchObject({ outcome: 'fail', source: 'run' });
	});

	it('uses the reviewer’s assessment made after an upheld appeal about the result', () => {
		const base = {
			results: [{ conformator_result_id: 'r1', test_id: 'A-1', outcome: 'fail', run_order: 0 }],
			appeals: [{ conformator_appeal_id: 'ap1', about_entity: 'conformator_result', about_id: 'r1' }],
			appealDecisions: [{ appeal_id: 'ap1', upheld: true, created_at: '2026-11-04' }]
		};
		expect(reviewedOutcomes(input({ ...base, assessments: [{ test_id: 'A-1', outcome: 'pass', created_at: '2026-11-03' }] }))[0].outcome).toBe('fail');
		expect(reviewedOutcomes(input({ ...base, assessments: [{ test_id: 'A-1', outcome: 'pass', created_at: '2026-11-05' }] }))[0]).toMatchObject({
			outcome: 'pass',
			source: 'assessment'
		});
	});

	it('shows an approved, unexpired waiver beside the outcome without changing it', () => {
		const w = {
			results: [{ test_id: 'A-1', outcome: 'fail', run_order: 0 }],
			waiverRequests: [{ conformator_waiver_request_id: 'w1', test_id: 'A-1' }]
		};
		const approved = reviewedOutcomes(input({ ...w, waiverDecisions: [{ waiver_request_id: 'w1', approved: true, expires_on: '2026-12-31', reason: 'Fix due' }] }))[0];
		expect(approved).toMatchObject({ outcome: 'fail', waiver: { expires_on: '2026-12-31', reason: 'Fix due' } });
		expect(reviewedOutcomes(input({ ...w, waiverDecisions: [{ waiver_request_id: 'w1', approved: true, expires_on: '2026-11-10' }] }))[0].waiver).toBeNull();
		expect(reviewedOutcomes(input({ ...w, waiverDecisions: [{ waiver_request_id: 'w1', approved: false, expires_on: '2026-12-31' }] }))[0].waiver).toBeNull();
	});
});

describe('approvalBlockers', () => {
	it('names mandatory tests that failed or have no outcome, unless waived', () => {
		const rows = reviewedOutcomes(
			input({
				results: [{ test_id: 'A-1', outcome: 'fail', run_order: 0 }],
				assessments: [{ test_id: 'C-1', outcome: 'fail' }]
			})
		);
		expect(approvalBlockers(rows)).toEqual(['A-1 failed.', 'E-1 has no pass or fail yet.']);
	});

	it('lets a waived failure through', () => {
		const rows = reviewedOutcomes(
			input({
				results: [{ test_id: 'A-1', outcome: 'fail', run_order: 0 }],
				assessments: [{ test_id: 'E-1', outcome: 'not_applicable' }],
				waiverRequests: [{ conformator_waiver_request_id: 'w1', test_id: 'A-1' }],
				waiverDecisions: [{ waiver_request_id: 'w1', approved: true, expires_on: '2027-01-01' }]
			})
		);
		expect(approvalBlockers(rows)).toEqual([]);
	});
});

describe('submissionStatus', () => {
	it('follows assignment and the latest approval', () => {
		expect(submissionStatus([], [])).toBe('submitted');
		expect(submissionStatus([], [{}])).toBe('under_review');
		expect(submissionStatus([{ approved: false, created_at: '1' }, { approved: true, created_at: '2' }], [{}])).toBe('approved');
		expect(submissionStatus([{ approved: true, created_at: '1' }, { approved: false, created_at: '2' }], [])).toBe('refused');
	});
});

describe('mayApprove', () => {
	it('refuses whoever assessed a test of the submission', () => {
		expect(mayApprove('u1', [{ created_by: 'u2' }])).toBe(true);
		expect(mayApprove('u1', [{ created_by: 'u1' }])).toBe(false);
	});
});

describe('reopened', () => {
	const refusal = [{ conformator_approval_id: 'ap', approved: false, created_at: '1' }];
	const appeal = [{ conformator_appeal_id: 'x', about_entity: 'conformator_approval', about_id: 'ap' }];

	it('is closed before any decision, after an approval, and after a refusal without an upheld appeal', () => {
		expect(reopened([], [], [])).toBe(false);
		expect(reopened([{ conformator_approval_id: 'ap', approved: true }], appeal, [{ appeal_id: 'x', upheld: true }])).toBe(false);
		expect(reopened(refusal, appeal, [{ appeal_id: 'x', upheld: false }])).toBe(false);
	});

	it('opens again after an upheld appeal about the refusal', () => {
		expect(reopened(refusal, appeal, [{ appeal_id: 'x', upheld: true }])).toBe(true);
	});
});
