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
import { funnelByCall, participantProgress, programmeRows } from '$lib/dashboard';
import { milestoneOf, todayUtc } from '$lib/milestones';
import { APPLICATION, ATTENDANCE, CALL, MILESTONE, MILESTONE_REPORT, MILESTONE_REVIEW, PARTICIPANT, PROGRAMME, SCREENING_DECISION } from './entities/definitions';
import { attendanceOf } from './sessions';
import { messageOf } from './errors';
import { reports, reviewsForStaff } from './milestones';
import { participantOf } from './participants';
import { idOf, listRecords } from './records';
import { staffAccess } from './staffAccess';

/** The Roles each part of the dashboard needs, at the space. */
export const DASHBOARD_ROLES = {
	applications: `CanGetDynamicEntityRecord_${APPLICATION}`,
	decisions: `CanGetDynamicEntityRecord_${SCREENING_DECISION}`,
	participants: `CanGetDynamicEntityRecord_${PARTICIPANT}`,
	reports: `CanGetDynamicEntityRecord_${MILESTONE_REPORT}`,
	reviews: `CanGetDynamicEntityRecord_${MILESTONE_REVIEW}`,
	attendance: `CanGetDynamicEntityRecord_${ATTENDANCE}`
};

/**
 * Everything the dashboard and its CSV exports show, read with the staff member's own token and Roles. A part the
 * staff member lacks a Role for comes back empty, with the Role in `lacking`, rather than failing the page.
 */
export async function dashboardData(token: string) {
	const [calls, programmes, milestones, apps, decisions, participants, reportList, reviewList, access, attendance] = await Promise.allSettled([
		listRecords(CALL, 'public'),
		listRecords(PROGRAMME, 'public'),
		listRecords(MILESTONE, 'public'),
		listRecords(APPLICATION, 'community', token),
		listRecords(SCREENING_DECISION, '', token),
		listRecords(PARTICIPANT, '', token),
		reports('community', token),
		reviewsForStaff(token),
		staffAccess(token),
		listRecords(ATTENDANCE, '', token)
	]);
	const ok = <T>(r: PromiseSettledResult<T>, fallback: T): T => (r.status === 'fulfilled' ? r.value : fallback);
	const roles = ok(access, null)?.roles ?? [];
	const lacking = Object.fromEntries(
		Object.entries(DASHBOARD_ROLES).map(([k, name]) => [k, roles.find((r) => r.role_name === name && !r.held) ?? null])
	) as Record<keyof typeof DASHBOARD_ROLES, (typeof roles)[number] | null>;

	const callList = ok(calls, []).map((c) => ({ id: idOf(CALL, c), title: String(c.title ?? '') }));
	const programmeList = ok(programmes, []).map((p) => ({ id: idOf(PROGRAMME, p), name: String(p.name ?? '') }));
	const milestoneList = ok(milestones, []).map((m) => milestoneOf(idOf(MILESTONE, m), m));
	const funnel = funnelByCall(
		callList,
		ok(apps, []).map((a) => ({ id: idOf(APPLICATION, a), call_id: String(a.call_id ?? ''), status: String(a.status ?? ''), eligibility: String(a.eligibility ?? '') })),
		ok(decisions, []).map((d) => ({ application_id: String(d.application_id ?? ''), decision: String(d.decision ?? ''), decided_at: String(d.decided_at ?? '') }))
	).filter((row) => row.started > 0);

	const today = todayUtc();
	const programmeName = new Map(programmeList.map((p) => [p.id, p.name]));
	const startups = ok(participants, [])
		.map(participantOf)
		.map((p) => ({
			...participantProgress(p, programmeName.get(p.programme_id) ?? '', milestoneList, ok(reportList, []), ok(reviewList, []), today, ok(attendance, []).map(attendanceOf)),
			programme_id: p.programme_id
		}))
		.sort((a, b) => b.behind - a.behind || a.startup_name.localeCompare(b.startup_name));
	const programmesTable = programmeRows(programmeList, startups).filter((row) => row.participants > 0);

	return {
		funnel,
		programmes: programmesTable,
		startups,
		lacking,
		errors: {
			applications: apps.status === 'rejected' && !lacking.applications ? messageOf(apps.reason) : null,
			participants: participants.status === 'rejected' && !lacking.participants ? messageOf(participants.reason) : null
		},
		space: ok(access, null)?.space ?? '',
		entitlementRequestsUrl: ok(access, null)?.entitlementRequestsUrl ?? null
	};
}
