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
import { latestDecision } from '$lib/screening';
import { APPLICATION, CALL, SCREENING_DECISION } from './entities/definitions';
import { idOf, listRecords, type CohortRecord } from './records';

export interface StaffApplicationRow {
	id: string;
	call_id: string;
	call: string;
	startup_name: string;
	status: string;
	eligibility: string;
	submitted_at: string;
	/** The latest screening decision, or '' when none has been made. */
	decision: string;
}

/**
 * Every application, read through the community URL (needs CanGetDynamicEntityRecord_cohort_application), with its
 * call's title and its latest decision. Throws when the applications cannot be read; decisions the User cannot read
 * are left out.
 */
export async function staffApplications(token: string, calls?: CohortRecord[]): Promise<StaffApplicationRow[]> {
	const [applications, decisions, callList] = await Promise.all([
		listRecords(APPLICATION, 'community', token),
		listRecords(SCREENING_DECISION, '', token).catch(() => []),
		calls ? Promise.resolve(calls) : listRecords(CALL, 'public').catch(() => [])
	]);
	const callTitles = new Map(callList.map((c) => [idOf(CALL, c), String(c.title ?? '')]));
	return applications.map((a) => ({
		id: idOf(APPLICATION, a),
		call_id: String(a.call_id ?? ''),
		call: callTitles.get(String(a.call_id)) ?? String(a.call_id ?? ''),
		startup_name: String(a.startup_name ?? ''),
		status: String(a.status ?? ''),
		eligibility: String(a.eligibility ?? ''),
		submitted_at: String(a.submitted_at ?? ''),
		decision: String(latestDecision(idOf(APPLICATION, a), decisions)?.decision ?? '')
	}));
}

export interface ApplicationFilter {
	call_id?: string;
	/** A decision, 'none' for undecided, or '' for any. */
	decision?: string;
}

/** Submitted applications matching the filter, newest submission first. */
export function submittedApplications(rows: StaffApplicationRow[], filter: ApplicationFilter = {}): StaffApplicationRow[] {
	return rows
		.filter((a) => a.status === 'submitted')
		.filter((a) => !filter.call_id || a.call_id === filter.call_id)
		.filter((a) => !filter.decision || (filter.decision === 'none' ? !a.decision : a.decision === filter.decision))
		.sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
}
