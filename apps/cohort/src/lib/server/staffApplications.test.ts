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
import { submittedApplications, type StaffApplicationRow } from './staffApplications';

const row = (id: string, over: Partial<StaffApplicationRow>): StaffApplicationRow => ({
	id,
	call_id: 'c1',
	call: 'Call 1',
	startup_name: id,
	status: 'submitted',
	eligibility: 'eligible',
	submitted_at: '2026-10-01T10:00:00Z',
	decision: '',
	...over
});

describe('submittedApplications', () => {
	const rows = [
		row('draft', { status: 'draft', submitted_at: '' }),
		row('old', { submitted_at: '2026-09-01T10:00:00Z', decision: 'shortlisted' }),
		row('new', { submitted_at: '2026-10-20T10:00:00Z' }),
		row('other-call', { call_id: 'c2', decision: 'rejected' })
	];

	it('lists submitted applications only, newest first', () => {
		expect(submittedApplications(rows).map((a) => a.id)).toEqual(['new', 'other-call', 'old']);
	});

	it('filters by call and by decision, including undecided', () => {
		expect(submittedApplications(rows, { call_id: 'c2' }).map((a) => a.id)).toEqual(['other-call']);
		expect(submittedApplications(rows, { decision: 'shortlisted' }).map((a) => a.id)).toEqual(['old']);
		expect(submittedApplications(rows, { decision: 'none' }).map((a) => a.id)).toEqual(['new']);
	});
});
