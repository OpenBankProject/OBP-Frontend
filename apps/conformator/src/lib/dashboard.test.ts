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
import { buildDashboard, toCsv, type DashboardInput } from './dashboard';

const input: DashboardInput = {
	participants: [
		{ conformator_participant_id: 'p1', legal_name: 'Bank B', category: 'bank', space_id: 's1' },
		{ conformator_participant_id: 'p2', legal_name: 'Bank A', category: 'bank', space_id: 's2' },
		{ conformator_participant_id: 'p3', legal_name: 'Fintech', category: 'fintech', space_id: 's3' }
	],
	decisions: [
		{ participant_id: 'p1', stage: 'admitted', created_at: '2026-10-01' },
		{ participant_id: 'p1', stage: 'graduated', created_at: '2026-11-01' },
		{ participant_id: 'p2', stage: 'testing', created_at: '2026-11-01' }
	],
	reports: [
		{ standing: 'valid', participant_id: 'p1', content: { suite: { code: 'AIS' } } },
		{ standing: 'superseded', participant_id: 'p1', content: { suite: { code: 'AIS' } } },
		{ standing: 'withdrawn', participant_id: 'p2', content: { suite: { code: 'PIS' } } }
	],
	suites: [
		{ code: 'AIS', api_family: 'account_information' },
		{ code: 'PIS', api_family: 'payment_initiation' }
	],
	spaces: {
		s1: {
			runs: [{ created_at: '2026-11-05T10:00:00Z' }, { created_at: '2026-09-01T10:00:00Z' }],
			results: [{ test_id: 'T-1', outcome: 'fail' }, { test_id: 'T-2', outcome: 'pass' }],
			submissions: [],
			openSubmissions: 0
		},
		s2: { runs: [], results: [{ test_id: 'T-1', outcome: 'fail' }, { test_id: 'T-3', outcome: 'fail' }, { test_id: 'T-3', outcome: 'fail' }], submissions: [], openSubmissions: 1 }
	},
	today: '2026-11-11'
};

describe('buildDashboard', () => {
	const d = buildDashboard(input);

	it('counts participants by their current stage and kind', () => {
		expect(d.byStage).toMatchObject({ graduated: 1, testing: 1, not_admitted: 1, admitted: 0 });
		expect(d.byCategory).toMatchObject({ bank: 2, fintech: 1 });
	});

	it('lists each participant with its valid reports and recent runs, and unknown for spaces it cannot read', () => {
		expect(d.participants.map((p) => p.legal_name)).toEqual(['Bank A', 'Bank B', 'Fintech']);
		expect(d.participants[1]).toMatchObject({ valid_reports: ['AIS'], runs_last_30_days: 1, last_run_at: '2026-11-05T10:00:00Z', open_submissions: 0 });
		expect(d.participants[2]).toMatchObject({ runs_last_30_days: null, last_run_at: null, open_submissions: null });
		expect(d.spacesReadable).toBe(2);
		expect(d.spacesTotal).toBe(3);
	});

	it('counts reports by standing, and valid ones by API family and kind of participant', () => {
		expect(d.reportsByStanding).toEqual({ valid: 1, expired: 0, superseded: 1, withdrawn: 1 });
		expect(d.validByFamily).toEqual({ account_information: 1 });
		expect(d.validByCategory).toEqual({ bank: 1 });
	});

	it('ranks the tests failed by the most participants first', () => {
		expect(d.mostFailed).toEqual([
			{ test_id: 'T-1', failures: 2, participants: 2 },
			{ test_id: 'T-3', failures: 2, participants: 1 }
		]);
	});
});

describe('toCsv', () => {
	it('quotes what needs quoting and joins lists', () => {
		expect(toCsv([{ a: 'x, y', b: ['P', 'Q'], c: 'say "hi"' }], ['a', 'b', 'c'])).toBe('a,b,c\r\n"x, y",P; Q,"say ""hi"""\r\n');
	});

	it('makes a value that a spreadsheet would read as a formula plain text', () => {
		expect(toCsv([{ a: '=SUM(A1)' }], ['a'])).toBe("a\r\n'=SUM(A1)\r\n");
	});

	it('leaves empty cells for null', () => {
		expect(toCsv([{ a: null, b: 0 }], ['a', 'b'])).toBe('a,b\r\n,0\r\n');
	});
});
