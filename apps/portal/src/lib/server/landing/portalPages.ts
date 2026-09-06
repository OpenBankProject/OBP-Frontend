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
 * Published App Studio pages, read from the OBP dynamic entity `obp_portal_page` with the
 * Portal's application token. Only records with status "published" ever leave this module,
 * so drafts are invisible to visitors even if the entity holds them.
 *
 * The Portal's consumer needs the Scope CanGetDynamicEntity_Systemobp_portal_page (the
 * entity's auth mode is UserOrApplication). See the API Manager's App Studio Help page.
 */
import { createLogger } from '@obp/shared/utils';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';
import { getApplicationAccessToken } from '$lib/server/oauth/applicationToken';

const logger = createLogger('PortalPages');

export const PORTAL_PAGE_ENTITY = 'obp_portal_page';
const LIST_PATH = `/obp/dynamic-entity/${PORTAL_PAGE_ENTITY}`;
const CACHE_TTL_MS = 60_000;

export interface PublishedPage {
	id: string;
	slug: string;
	title: string;
	kind: 'page' | 'app';
	summary: string;
	source: string;
	author: string;
	updated_at: string;
}

export class PortalPagesUnavailable extends Error {
	constructor(message: string, public readonly cause?: unknown) {
		super(message);
		this.name = 'PortalPagesUnavailable';
	}
}

let cache: { at: number; pages: PublishedPage[] } | null = null;

function toPage(raw: any): PublishedPage | null {
	const r = raw?.[PORTAL_PAGE_ENTITY] ?? raw;
	if (!r || r.status !== 'published') return null;
	const slug = String(r.slug ?? '').trim();
	if (!slug) return null;
	return {
		id: String(r[`${PORTAL_PAGE_ENTITY}_id`] ?? ''),
		slug,
		title: String(r.title ?? slug),
		kind: r.kind === 'app' ? 'app' : 'page',
		summary: String(r.summary ?? ''),
		source: String(r.source ?? ''),
		author: String(r.author ?? ''),
		updated_at: String(r.updated_at ?? '')
	};
}

/** Every published page, newest first. Cached for a minute. */
export async function listPublishedPages(): Promise<PublishedPage[]> {
	if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.pages;
	const token = await getApplicationAccessToken();
	if (!token) {
		throw new PortalPagesUnavailable('The Portal has no application token to read pages with (check OBP_OAUTH_CLIENT_ID / OBP_OAUTH_CLIENT_SECRET).');
	}
	let response: any;
	try {
		response = await obp_requests.get(LIST_PATH, token);
	} catch (e) {
		if (e instanceof OBPRequestError) {
			logger.error(`Could not read ${PORTAL_PAGE_ENTITY}: ${e.message}`);
			throw new PortalPagesUnavailable(
				`OBP refused to list ${PORTAL_PAGE_ENTITY} (${e.message}). The Portal's consumer needs the Scope CanGetDynamicEntity_System${PORTAL_PAGE_ENTITY}, and the entity must exist.`,
				e
			);
		}
		throw new PortalPagesUnavailable(`Could not reach OBP: ${e instanceof Error ? e.message : String(e)}`, e);
	}
	const listKey = Object.keys(response ?? {}).find((k) => Array.isArray(response[k]));
	const records: any[] = listKey ? response[listKey] : Array.isArray(response) ? response : [];
	const pages = records.map(toPage).filter((p): p is PublishedPage => p !== null);
	// One slug, one page: the most recently updated wins.
	pages.sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1));
	const seen = new Set<string>();
	const unique = pages.filter((p) => (seen.has(p.slug) ? false : (seen.add(p.slug), true)));
	cache = { at: Date.now(), pages: unique };
	return unique;
}

export async function getPublishedPage(slug: string): Promise<PublishedPage | null> {
	const pages = await listPublishedPages();
	return pages.find((p) => p.slug === slug) ?? null;
}

/** Forget the cache, e.g. after a publish. */
export function invalidatePortalPagesCache(): void {
	cache = null;
}
