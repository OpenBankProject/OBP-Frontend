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
import { menuItemOf } from '@obp/shared/landing';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { appDirectory } from '$lib/server/appDirectory';
import { cohortSpace } from '$lib/server/space';
import { cohortPages, HOME_PAGE_SLUG } from '$lib/server/sitePages';
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
	// The pages published to Cohort with App Studio, in the visitor's language: directly in the menu. The home page is
	// the start page, not a menu item.
	const sitePages = (await cohortPages(locals.locale)).filter((p) => p.slug !== HOME_PAGE_SLUG).map(menuItemOf);
	// Opey shows on every page where it is configured. Its public URL is informational (the connection popover).
	// Cohort's bank_id is Opey's default bank; where its data is goes with each message from the server (lib/server/opey).
	const opey = env.OPEY_BASE_URL ? { baseUrl: publicEnv.PUBLIC_OPEY_BASE_URL ?? '', bankId: cohortSpace() } : null;
	return {
		isStaff,
		opey,
		portalUrl,
		sitePages,
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
