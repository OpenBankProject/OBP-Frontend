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

/** The funnel of each call as CSV, read with the staff member's own Roles. */
export const GET: RequestHandler = async ({ locals }) => {
	const token = userToken(locals);
	if (!token) return new Response('Log in first', { status: 401 });
	const { funnel } = await dashboardData(token);
	const csv = toCsv(
		['call', 'started', 'submitted', 'eligible', 'shortlisted', 'accepted', 'waitlisted', 'not_selected'],
		funnel.map((r) => [r.call, r.started, r.submitted, r.eligible, r.shortlisted, r.accepted, r.waitlisted, r.rejected])
	);
	return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="cohort-funnel.csv"' } });
};
