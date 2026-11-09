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
import { funnelByCall, participantProgress, programmeRows, riskOf, toCsv } from './dashboard';

describe('funnelByCall', () => {
	it('counts each stage of the funnel by the decisions', () => {
		const apps = [
			{ id: 'draft', call_id: 'c', status: 'draft', eligibility: '' },
			{ id: 'a', call_id: 'c', status: 'submitted', eligibility: 'eligible' },
			{ id: 'b', call_id: 'c', status: 'submitted', eligibility: 'eligible' },
			{ id: 'r', call_id: 'c', status: 'submitted', eligibility: 'needs_review' },
			{ id: 'other', call_id: 'x', status: 'submitted', eligibility: 'eligible' }
		];
		const decisions = [
			{ application_id: 'a', decision: 'shortlisted', decided_at: '2026-11-01T10:00:00Z' },
			{ application_id: 'a', decision: 'accepted', decided_at: '2026-11-02T10:00:00Z' },
			{ application_id: 'b', decision: 'shortlisted', decided_at: '2026-11-01T10:00:00Z' },
			{ application_id: 'b', decision: 'waitlisted', decided_at: '2026-11-02T10:00:00Z' },
			{ application_id: 'r', decision: 'rejected', decided_at: '2026-11-01T10:00:00Z' }
		];
		expect(funnelByCall([{ id: 'c', title: 'Call' }], apps, decisions)).toEqual([
			{ call_id: 'c', call: 'Call', started: 4, submitted: 3, eligible: 2, shortlisted: 2, accepted: 1, waitlisted: 1, rejected: 1 }
		]);
	});
});

describe('programme progress', () => {
	const milestones = [
		{ id: 'm1', programme_id: 'p', title: 'MVP', description: '', due_on: '2027-01-01', position: 1 },
		{ id: 'm2', programme_id: 'p', title: 'Customer', description: '', due_on: '2027-06-01', position: 2 }
	];
	const reports = [{ id: 'r1', milestone_id: 'm1', participant_id: 'one', note: '', submitted_at: '2026-12-01T10:00:00Z' }];
	const reviews = [{ report_id: 'r1', milestone_id: 'm1', participant_id: 'one', decision: 'accepted', message_to_startup: '', decided_at: '2026-12-02T10:00:00Z' }];
	const one = { id: 'one', programme_id: 'p', startup_name: 'One', customer_id: 'cust', stage: 'onboarded', status: 'active' };
	const two = { id: 'two', programme_id: 'p', startup_name: 'Two', customer_id: '', stage: 'onboarded', status: 'active', risk: 'at_risk' as const, risk_note: 'No pilot yet' };

	it('counts milestones accepted and behind per startup, and completion per programme', () => {
		const p1 = { ...participantProgress(one, 'Prog', milestones, reports, reviews, '2027-02-01'), programme_id: 'p' };
		const p2 = { ...participantProgress(two, 'Prog', milestones, reports, reviews, '2027-02-01'), programme_id: 'p' };
		expect(p1).toMatchObject({ milestones_accepted: 1, milestones_total: 2, behind: 0, company_registered: true });
		expect(p1).toMatchObject({ risk: 'none', risk_note: '' });
		expect(p2).toMatchObject({ milestones_accepted: 0, behind: 1, company_registered: false, risk: 'at_risk', risk_note: 'No pilot yet' });
		expect(programmeRows([{ id: 'p', name: 'Prog' }], [p1, p2])).toEqual([
			{
				programme_id: 'p', programme: 'Prog', participants: 2, onboarded: 2, in_programme: 0, graduated: 0,
				companies_registered: 1, milestones_accepted: 1, milestones_due: 4, completion: 25, behind_startups: 1, flagged_startups: 1, sessions_attended: 0
			}
		]);
	});
});

describe('riskOf', () => {
	it('keeps a known risk level and reads anything else as none', () => {
		expect(riskOf('watch')).toBe('watch');
		expect(riskOf('at_risk')).toBe('at_risk');
		expect(riskOf('high')).toBe('none');
		expect(riskOf(undefined)).toBe('none');
	});
});

describe('toCsv', () => {
	it('quotes every field and doubles quotes', () => {
		expect(toCsv(['a', 'b'], [['x "y"', 3], [null, true]])).toBe('"a","b"\r\n"x ""y""","3"\r\n"","true"\r\n');
	});
});
