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
import { OBPRequestError } from '../../obp/errors.js';
import { SITE_PAGE_ENTITY } from '../../landing/sitePages.js';

/** The list path of the App Studio pages (a system dynamic entity). */
export const SITE_PAGES_PATH = `/obp/dynamic-entity/${SITE_PAGE_ENTITY}`;

/**
 * Every App Studio page record, read with the app's own application token (visitors may be anonymous). The app's
 * Consumer needs the Scope CanGetDynamicEntityRecord_obp_portal_page at bank id SYS. OBP answers 404 until the
 * entity is defined, i.e. nothing has been published yet: that is an empty list, not an error.
 */
export async function fetchSitePageRecords(get: (path: string, token: string) => Promise<unknown>, token: string): Promise<unknown[]> {
	let response: unknown;
	try {
		response = await get(SITE_PAGES_PATH, token);
	} catch (e) {
		if (e instanceof OBPRequestError && e.code === '404') return [];
		throw e;
	}
	if (Array.isArray(response)) return response;
	const r = (response ?? {}) as Record<string, unknown>;
	const listKey = Object.keys(r).find((k) => Array.isArray(r[k]));
	return listKey ? (r[listKey] as unknown[]) : [];
}
