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
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * The staff pages are for staff: a User who holds no staff Role is sent to /staff/access, where they can ask for one.
 * This is for clarity, not protection: every staff page reads its data with the User's own Roles, which OBP-API checks.
 */
export const load: LayoutServerLoad = async ({ parent, url }) => {
	const { isStaff } = await parent();
	// The old setup address passes through to its redirect: setup needs no staff Role.
	if (!isStaff && url.pathname !== '/staff/access' && url.pathname !== '/staff/setup') redirect(303, '/staff/access?no_role=1');
	return {};
};
