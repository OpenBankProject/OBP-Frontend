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
import { describe, expect, it } from 'vitest';
import { milestoneProgress, sortedMilestones, type Milestone, type MilestoneReport, type MilestoneReview } from './milestones';

const mvp: Milestone = { id: 'm1', programme_id: 'p', title: 'MVP built', description: '', due_on: '2027-02-15', position: 1 };
const report = (id: string, at: string, participant = 'startup'): MilestoneReport => ({ id, milestone_id: 'm1', participant_id: participant, note: '', submitted_at: at });
const review = (reportId: string, decision: string, at: string): MilestoneReview => ({ report_id: reportId, milestone_id: 'm1', participant_id: 'startup', decision, message_to_startup: '', decided_at: at });

describe('milestoneProgress', () => {
	it('is not started without a report, and behind once past due', () => {
		expect(milestoneProgress(mvp, 'startup', [], [], '2027-02-01')).toMatchObject({ status: 'not_started', behind: false });
		expect(milestoneProgress(mvp, 'startup', [], [], '2027-02-16')).toMatchObject({ status: 'not_started', behind: true });
	});

	it('follows the newest report: submitted, returned, then submitted again', () => {
		const first = report('r1', '2027-02-01T10:00:00Z');
		const returned = review('r1', 'returned', '2027-02-02T10:00:00Z');
		expect(milestoneProgress(mvp, 'startup', [first], [], '2027-02-03').status).toBe('submitted');
		expect(milestoneProgress(mvp, 'startup', [first], [returned], '2027-02-03').status).toBe('returned');
		const second = report('r2', '2027-02-04T10:00:00Z');
		expect(milestoneProgress(mvp, 'startup', [first, second], [returned], '2027-02-05').status).toBe('submitted');
	});

	it('stays accepted, and is never behind once accepted', () => {
		const r = report('r1', '2027-02-01T10:00:00Z');
		const p = milestoneProgress(mvp, 'startup', [r], [review('r1', 'accepted', '2027-02-02T10:00:00Z')], '2027-03-01');
		expect(p).toMatchObject({ status: 'accepted', behind: false });
	});

	it("ignores other startups' reports", () => {
		expect(milestoneProgress(mvp, 'startup', [report('r9', '2027-02-01T10:00:00Z', 'other')], [], '2027-02-03').status).toBe('not_started');
	});
});

describe('sortedMilestones', () => {
	it('orders by position, then due date', () => {
		const later = { ...mvp, id: 'm2', position: 1, due_on: '2027-04-01' };
		const first = { ...mvp, id: 'm0', position: 0 };
		expect(sortedMilestones([later, mvp, first]).map((m) => m.id)).toEqual(['m0', 'm1', 'm2']);
	});
});
