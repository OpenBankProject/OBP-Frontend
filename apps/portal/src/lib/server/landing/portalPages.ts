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
/**
 * Published App Studio pages for the Portal: those whose sites include the Portal, read from the OBP dynamic
 * entity `obp_portal_page` with the Portal's application token. Only records with status "published" ever leave
 * this module, so drafts are invisible to visitors even if the entity holds them. They appear directly in the
 * Portal's menu, in their menu order.
 *
 * The Portal's consumer needs the Scope CanGetDynamicEntityRecord_obp_portal_page at bank id SYS (the
 * entity's auth mode is UserOrApplication). See the API Manager's App Studio Help page.
 */
import { createLogger } from '@obp/shared/utils';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';
import { publishedPagesFor, SITE_PAGE_ENTITY, type SitePage } from '@obp/shared/landing';
import { fetchSitePageRecords } from '@obp/shared/server/landing';
import { requestApplicationAccessToken } from '$lib/server/oauth/applicationToken';

const logger = createLogger('PortalPages');

const CACHE_TTL_MS = 60_000;

/** The Portal is in English: it shows pages in English and those for every language. */
const PORTAL_LANG = 'en';

export type PublishedPage = SitePage;

export class PortalPagesUnavailable extends Error {
	constructor(message: string, public readonly cause?: unknown) {
		super(message);
		this.name = 'PortalPagesUnavailable';
	}
}

let cache: { at: number; pages: PublishedPage[] } | null = null;

/** Every page published to the Portal, in menu order. Cached for a minute. */
export async function listPublishedPages(): Promise<PublishedPage[]> {
	if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.pages;
	const tokenResult = await requestApplicationAccessToken();
	if (tokenResult.token === null) {
		throw new PortalPagesUnavailable(`The Portal has no application token to read pages with: ${tokenResult.reason}.`);
	}
	let records: unknown[];
	try {
		records = await fetchSitePageRecords((path, token) => obp_requests.get(path, token), tokenResult.token);
	} catch (e) {
		if (e instanceof OBPRequestError) {
			logger.error(`Could not read ${SITE_PAGE_ENTITY}: ${e.message}`);
			throw new PortalPagesUnavailable(
				`OBP refused to list ${SITE_PAGE_ENTITY} (${e.message}). The Portal's consumer needs the Scope CanGetDynamicEntityRecord_${SITE_PAGE_ENTITY} at bank id SYS, and the entity must exist.`,
				e
			);
		}
		throw new PortalPagesUnavailable(`Could not reach OBP: ${e instanceof Error ? e.message : String(e)}`, e);
	}
	const pages = publishedPagesFor(records, 'portal', PORTAL_LANG);
	cache = { at: Date.now(), pages };
	return pages;
}

export async function getPublishedPage(slug: string): Promise<PublishedPage | null> {
	const pages = await listPublishedPages();
	return pages.find((p) => p.slug === slug) ?? null;
}

/** Forget the cache, e.g. after a publish. */
export function invalidatePortalPagesCache(): void {
	cache = null;
}
