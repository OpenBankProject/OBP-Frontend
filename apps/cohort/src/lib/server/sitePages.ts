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
import { createLogger } from '@obp/shared/utils';
import { publishedPagesFor, type SitePage } from '@obp/shared/landing';
import { fetchSitePageRecords } from '@obp/shared/server/landing';
import { requestApplicationAccessToken } from './applicationToken';
import { obpRequests } from './obp';

/**
 * The pages published to Cohort with the API Manager's App Studio (About, location, the applicant journey and so
 * on): records of the obp_portal_page system dynamic entity whose sites include Cohort. They are read with Cohort's
 * application token, so anonymous visitors see them too; Cohort's Consumer needs the Scope
 * CanGetDynamicEntityRecord_obp_portal_page at bank id SYS. A visitor sees the pages in their language and those
 * for every language, directly in the menu.
 */

const logger = createLogger('CohortPages');

/** The page with this slug is Cohort's home page, not a menu item. */
export const HOME_PAGE_SLUG = 'home';
const CACHE_TTL_MS = 60_000;
let cache: { at: number; records: unknown[] } | null = null;

async function records(): Promise<unknown[]> {
	if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.records;
	const app = await requestApplicationAccessToken();
	if (app.token === null) throw new Error(`Cohort has no application token to read pages with: ${app.reason}`);
	const list = await fetchSitePageRecords((path, t) => obpRequests.get(path, t), app.token);
	cache = { at: Date.now(), records: list };
	return list;
}

/** The pages Cohort shows in `locale`, in menu order; none when they cannot be read (logged). */
export async function cohortPages(locale: string): Promise<SitePage[]> {
	try {
		return publishedPagesFor(await records(), 'cohort', locale);
	} catch (err) {
		logger.warn('Could not read the published pages:', err);
		return [];
	}
}

/** One published page by slug, in `locale` or for every language; null when there is none. */
export async function cohortPage(slug: string, locale: string): Promise<SitePage | null> {
	return (await cohortPages(locale)).find((p) => p.slug === slug) ?? null;
}
