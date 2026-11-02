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
import { dashboardData } from '$lib/server/dashboard';
import { userToken } from '$lib/server/records';
import { requestRole } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

/** The management view: each call's funnel and each programme's progress, read with the staff member's Roles. */
export const load: PageServerLoad = async ({ locals }) => dashboardData(userToken(locals)!);

export const actions: Actions = {
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!)
};
