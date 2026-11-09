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
 * Pages written in the API Manager's App Studio and published to a site's menu. They are records of the
 * obp_portal_page system dynamic entity; each names the sites that show it (the Portal, Cohort or both), its
 * language, and its place in the menu. Pure functions, used by the API Manager, the Portal and Cohort.
 */

export const SITE_PAGE_ENTITY = 'obp_portal_page';

/** The sites a page can be published to. */
export const PAGE_SITES = ['portal', 'cohort'] as const;
export type PageSite = (typeof PAGE_SITES)[number];

export interface SitePage {
	id: string;
	slug: string;
	title: string;
	kind: 'page' | 'app';
	status: 'draft' | 'published';
	summary: string;
	source: string;
	author: string;
	updated_at: string;
	/** The sites whose menu shows it. */
	sites: PageSite[];
	/** Its language, e.g. 'en' or 'ar'; '' for every language. */
	lang: string;
	/** Its place in the menu, lower first; null after the numbered ones. */
	menu_position: number | null;
}

const isSite = (v: string): v is PageSite => (PAGE_SITES as readonly string[]).includes(v);

/** The sites in a stored `sites` value ("portal,cohort"). A page saved before sites existed is a Portal page. */
export function sitesOf(value: unknown): PageSite[] {
	if (value === undefined || value === null) return ['portal'];
	return [...new Set(String(value).split(',').map((s) => s.trim().toLowerCase()).filter(isSite))];
}

/** A page from an obp_portal_page record, wrapped (`{ obp_portal_page: {...} }`) or not. */
export function sitePageOf(input: unknown): SitePage {
	const wrapped = input as Record<string, unknown> | null;
	const raw = (wrapped?.[SITE_PAGE_ENTITY] && typeof wrapped[SITE_PAGE_ENTITY] === 'object' ? wrapped[SITE_PAGE_ENTITY] : wrapped ?? {}) as Record<string, unknown>;
	const position = Number(raw.menu_position);
	return {
		id: String(raw[`${SITE_PAGE_ENTITY}_id`] ?? raw.id ?? ''),
		slug: String(raw.slug ?? '').trim(),
		title: String(raw.title ?? ''),
		kind: raw.kind === 'app' ? 'app' : 'page',
		status: raw.status === 'published' ? 'published' : 'draft',
		summary: String(raw.summary ?? ''),
		source: String(raw.source ?? ''),
		author: String(raw.author ?? ''),
		updated_at: String(raw.updated_at ?? ''),
		sites: sitesOf(raw.sites),
		lang: String(raw.lang ?? '').trim().toLowerCase(),
		menu_position: raw.menu_position === undefined || raw.menu_position === null || raw.menu_position === '' || !Number.isFinite(position) ? null : position
	};
}

/** Menu order: numbered pages first by number, then the rest; ties by title. */
export function byMenuPosition(a: SitePage, b: SitePage): number {
	const pa = a.menu_position ?? Number.POSITIVE_INFINITY;
	const pb = b.menu_position ?? Number.POSITIVE_INFINITY;
	return pa !== pb ? pa - pb : a.title.localeCompare(b.title);
}

/**
 * The published pages a site shows, in menu order: for `lang`, the pages in that language and those for every
 * language. One slug, one page: the most recently updated wins.
 */
export function publishedPagesFor(records: unknown[], site: PageSite, lang?: string): SitePage[] {
	const pages = records
		.map(sitePageOf)
		.filter((p) => p.status === 'published' && p.slug && p.sites.includes(site) && (!lang || !p.lang || p.lang === lang.toLowerCase()))
		.sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1));
	const seen = new Set<string>();
	return pages.filter((p) => (seen.has(p.slug) ? false : (seen.add(p.slug), true))).sort(byMenuPosition);
}

/** What a menu needs of a page. */
export const menuItemOf = (p: SitePage) => ({ slug: p.slug, title: p.title });
