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
import { currentUser, reviewsIn, staffRolesIn } from '$lib/server/staffAccess';
import { apiManagerUrl, appDirectory } from '$lib/server/appDirectory';
import { publicContent } from '$lib/server/publicContent';
import type { LayoutServerLoad } from './$types';

// Only what pages display goes to the browser; tokens stay in the server-side session.
export const load: LayoutServerLoad = async ({ locals, url }) => {
	const user = locals.session.data.user;
	const token = locals.session.data.oauth?.access_token;
	// Staff (any staff Role) see the Staff menu, and reviewers the Reviews page; OBP-API still checks every Role.
	const [held, content] = await Promise.all([
		user && token ? currentUser(token).then((u) => u?.entitlements?.list ?? []).catch(() => []) : Promise.resolve([]),
		// Links to the catalogue and to report checks are shown only when OBP-API answered and there is something to see.
		publicContent()
	]);
	return {
		isStaff: staffRolesIn(held).length > 0,
		isReviewer: reviewsIn(held),
		// The API Manager, from OBP-API's app directory: a link in the menu, as in the Portal.
		apiManagerUrl: await apiManagerUrl(),
		// The Portal, from OBP-API's app directory: Opey's status lights link to its status and consents pages.
		portalUrl: ((await appDirectory()).public_obp_portal_url || '').replace(/\/+$/, '') || null,
		// The User's Roles, for the shared role widgets on each page. OBP-API still checks every Role itself.
		userEntitlements: held.map((g) => ({ entitlement_id: String((g as { entitlement_id?: string }).entitlement_id ?? ''), role_name: g.role_name, bank_id: g.bank_id ?? '' })),
		content,
		path: url.pathname,
		user: user ? { username: user.username, email: user.email } : null
	};
};
