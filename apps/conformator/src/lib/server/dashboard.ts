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
import { idOf, listRecords, type EntityRecord } from './records';
import { APPROVAL, PARTICIPANT, PARTICIPANT_DECISION, RESULT, RUN, SUBMISSION, SUITE } from './entities/definitions';
import { allReports } from './reports';
import { mySpaces } from './spaces';
import { buildDashboard } from '$lib/dashboard';
import { roleCheck } from './staffAccess';
import { centralSpace } from './space';

const withCreated = (items: Array<{ record: EntityRecord; metadata: { created?: { at?: string | null } } }>): EntityRecord[] =>
	items.map(({ record, metadata }): EntityRecord => ({ ...record, created_at: metadata.created?.at ?? '' }));

/**
 * The dashboard, read with the User's own Roles: the participant register and decisions in the central space, the
 * public reports and suites, and the runs, results and submissions of every participant space the User can read.
 */
export async function loadDashboard(token: string) {
	const [participants, decisions, reports, suites, spaces] = await Promise.all([
		listRecords(PARTICIPANT, token).then((l) => l.map((r) => r.record)),
		listRecords(PARTICIPANT_DECISION, token).then(withCreated).catch(() => []),
		allReports().catch(() => []),
		listRecords(SUITE, undefined, { access: 'public' }).then((l) => l.map((r) => r.record)).catch(() => []),
		mySpaces(token, `CanGetDynamicEntityRecord_${RUN}`)
	]);
	const perSpace = await Promise.all(
		spaces.map(async (space) => {
			const where = { space: space.id };
			const [runs, results, submissions, approvals] = await Promise.all([
				listRecords(RUN, token, where).then(withCreated).catch(() => []),
				listRecords(RESULT, token, where).then((l) => l.map((r) => r.record)).catch(() => []),
				listRecords(SUBMISSION, token, where).then((l) => l.map((r) => r.record)).catch(() => []),
				listRecords(APPROVAL, token, where).then((l) => l.map((r) => r.record)).catch(() => [])
			]);
			const decided = new Set(approvals.map((a) => String(a.submission_id)));
			const openSubmissions = submissions.filter((s) => !decided.has(idOf(SUBMISSION, s))).length;
			return [space.id, { runs, results, submissions, openSubmissions }] as const;
		})
	);
	return buildDashboard({
		participants,
		decisions,
		reports: reports.map((r) => ({ standing: r.standing, participant_id: String(r.report.participant_id ?? ''), content: r.content })),
		suites,
		spaces: Object.fromEntries(perSpace),
		today: new Date().toISOString().slice(0, 10)
	});
}

/**
 * The Roles the dashboard needs, at the central space: the participant register and the lifecycle decisions. Runs,
 * results and submissions come from whichever participant spaces the User can read, so they need no Role here.
 */
export const DASHBOARD_ROLES = [`CanGetDynamicEntityRecord_${PARTICIPANT}`, `CanGetDynamicEntityRecord_${PARTICIPANT_DECISION}`];

/** Whether the User holds every Role the dashboard needs. */
export async function mayReadDashboard(token: string): Promise<boolean> {
	const can = await roleCheck(token);
	return DASHBOARD_ROLES.every((role) => can(role, centralSpace()));
}

/** The answer an export gives a User without the dashboard's Roles. */
export function dashboardRefused(): Response {
	return new Response(`The dashboard needs the Roles ${DASHBOARD_ROLES.join(' and ')} at ${centralSpace()}.\n`, {
		status: 403,
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});
}
