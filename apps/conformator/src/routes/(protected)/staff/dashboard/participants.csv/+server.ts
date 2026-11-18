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
import { dashboardRefused, loadDashboard, mayReadDashboard } from '$lib/server/dashboard';
import { userToken } from '$lib/server/records';
import { toCsv } from '$lib/dashboard';
import type { RequestHandler } from './$types';

/** The dashboard's participant table as CSV, for the regulator's own analysis tools. */
export const GET: RequestHandler = async ({ locals }) => {
	const token = userToken(locals)!;
	if (!(await mayReadDashboard(token))) return dashboardRefused();
	const d = await loadDashboard(token);
	const columns = ['participant_id', 'legal_name', 'category', 'stage', 'space_id', 'valid_reports', 'runs_last_30_days', 'last_run_at', 'open_submissions'];
	return new Response(toCsv(d.participants as unknown as Array<Record<string, unknown>>, columns), {
		headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="participants-${new Date().toISOString().slice(0, 10)}.csv"`, 'cache-control': 'no-store' }
	});
};
