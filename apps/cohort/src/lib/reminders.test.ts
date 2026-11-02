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
import { daysBetween, planReminders, type ReminderInput } from './reminders';

const base: ReminderInput = {
	today: '2027-02-10',
	milestones: [
		{ id: 'soon', programme_id: 'p', title: 'MVP built', description: '', due_on: '2027-02-15', position: 1 },
		{ id: 'late', programme_id: 'p', title: 'First customer', description: '', due_on: '2027-02-01', position: 2 },
		{ id: 'far', programme_id: 'p', title: 'Raise', description: '', due_on: '2027-06-01', position: 3 }
	],
	participants: [{ id: 'one', programme_id: 'p', startup_name: 'One', status: 'active', customer_id: 'c1' }],
	reports: [],
	reviews: [],
	drafts: [{ id: 'd1', call_id: 'call', startup_name: 'Draft Co', customer_id: 'c2' }],
	calls: [{ id: 'call', title: 'Fintech 2027', closes_at: '2027-02-12', status: 'open' }],
	sent: new Set()
};

describe('planReminders', () => {
	it('reminds of milestones due soon or overdue, and calls closing on drafts', () => {
		expect(planReminders(base).map((r) => r.key)).toEqual(['milestone_due:one:soon', 'milestone_overdue:one:late', 'call_closing:d1']);
	});

	it('never plans one already sent, nor one for an accepted or just-reported milestone', () => {
		const reports = [{ id: 'r', milestone_id: 'soon', participant_id: 'one', note: '', submitted_at: '2027-02-09T10:00:00Z' }];
		const reviews = [{ report_id: 'r0', milestone_id: 'late', participant_id: 'one', decision: 'accepted', message_to_startup: '', decided_at: '2027-02-02T10:00:00Z' }];
		const accepted = [{ id: 'r0', milestone_id: 'late', participant_id: 'one', note: '', submitted_at: '2027-02-01T10:00:00Z' }];
		const planned = planReminders({ ...base, reports: [...reports, ...accepted], reviews, sent: new Set(['call_closing:d1']) });
		expect(planned).toEqual([]);
	});

	it('skips startups no longer active, recipients without a Customer, and closed calls', () => {
		const planned = planReminders({
			...base,
			participants: [{ ...base.participants[0], status: 'graduated' }],
			drafts: [{ ...base.drafts[0], customer_id: '' }]
		});
		expect(planned).toEqual([]);
		expect(planReminders({ ...base, participants: [], calls: [{ ...base.calls[0], status: 'closed' }] })).toEqual([]);
	});

	it('counts whole days', () => {
		expect(daysBetween('2027-02-10', '2027-02-15')).toBe(5);
		expect(daysBetween('2027-02-10', '2027-02-01')).toBe(-9);
	});
});
