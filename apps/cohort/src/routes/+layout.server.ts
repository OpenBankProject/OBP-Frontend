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
import { appDirectory } from '$lib/server/appDirectory';
import { staffRolesHeld } from '$lib/server/staffAccess';
import type { LayoutServerLoad } from './$types';

// Only what pages display goes to the browser; tokens stay in the server-side session.
export const load: LayoutServerLoad = async ({ locals, url }) => {
	const user = locals.session.data.user;
	// The Portal, from OBP-API's app directory: Opey's status lights link to its status and consents pages.
	const portalUrl = ((await appDirectory()).public_obp_portal_url || '').replace(/\/+$/, '') || null;
	// Staff (any staff Role at the space) see the Staff menu and its pages; for everyone else they are hidden.
	const token = locals.session.data.oauth?.access_token;
	const isStaff = user && token ? (await staffRolesHeld(token).catch(() => [])).length > 0 : false;
	return {
		isStaff,
		portalUrl,
		locale: locals.locale,
		branding: locals.branding,
		path: url.pathname + url.search,
		user: user
			? {
					username: user.username,
					email: user.email,
					roleCount: user.entitlements?.list?.length ?? 0
				}
			: null
	};
};
