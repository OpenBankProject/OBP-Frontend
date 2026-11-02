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
import { toCsv } from '$lib/dashboard';
import { dashboardData } from '$lib/server/dashboard';
import { userToken } from '$lib/server/records';
import type { RequestHandler } from './$types';

/** Every participating startup's progress as CSV, read with the staff member's own Roles. */
export const GET: RequestHandler = async ({ locals }) => {
	const token = userToken(locals);
	if (!token) return new Response('Log in first', { status: 401 });
	const { startups } = await dashboardData(token);
	const csv = toCsv(
		['startup', 'programme', 'stage', 'status', 'company_registered', 'milestones_accepted', 'milestones_total', 'milestones_behind', 'sessions_attended'],
		startups.map((s) => [s.startup_name, s.programme, s.stage, s.status, s.company_registered, s.milestones_accepted, s.milestones_total, s.behind, s.sessions_attended])
	);
	return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="cohort-startups.csv"' } });
};
