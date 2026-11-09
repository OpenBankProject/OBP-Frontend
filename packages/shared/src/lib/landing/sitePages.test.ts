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
import { describe, expect, it } from 'vitest';
import { publishedPagesFor, sitePageOf, sitesOf } from './sitePages';

const page = (over: Record<string, unknown>) => ({
	obp_portal_page_id: String(over.slug),
	title: String(over.slug),
	kind: 'page',
	status: 'published',
	source: '<p>x</p>',
	updated_at: '2026-11-01T10:00:00Z',
	...over
});

describe('App Studio pages on sites', () => {
	it('reads a wrapped record with its sites, language and menu position', () => {
		const p = sitePageOf({ obp_portal_page: page({ slug: 'about', sites: 'cohort, portal', lang: 'AR', menu_position: '2' }) });
		expect(p).toMatchObject({ id: 'about', slug: 'about', sites: ['cohort', 'portal'], lang: 'ar', menu_position: 2 });
	});

	it('treats a page saved before sites existed as a Portal page, and ignores unknown sites', () => {
		expect(sitesOf(undefined)).toEqual(['portal']);
		expect(sitesOf('')).toEqual([]);
		expect(sitesOf('cohort,elsewhere,cohort')).toEqual(['cohort']);
	});

	it("lists a site's published pages in its visitor's language, in menu order", () => {
		const records = [
			page({ slug: 'privacy', sites: 'cohort' }),
			page({ slug: 'about', sites: 'cohort', lang: 'en', menu_position: 1 }),
			page({ slug: 'about-ar', sites: 'cohort', lang: 'ar', menu_position: 1 }),
			page({ slug: 'location', sites: 'portal,cohort', lang: 'en', menu_position: 2 }),
			page({ slug: 'hackathon', sites: 'portal' }),
			page({ slug: 'draft', sites: 'cohort', status: 'draft' })
		];
		expect(publishedPagesFor(records, 'cohort', 'en').map((p) => p.slug)).toEqual(['about', 'location', 'privacy']);
		expect(publishedPagesFor(records, 'cohort', 'ar').map((p) => p.slug)).toEqual(['about-ar', 'privacy']);
		expect(publishedPagesFor(records, 'portal', 'en').map((p) => p.slug)).toEqual(['location', 'hackathon']);
	});

	it('keeps the most recently updated page of a slug', () => {
		const records = [page({ slug: 'about', title: 'Old', sites: 'cohort' }), page({ slug: 'about', title: 'New', sites: 'cohort', updated_at: '2026-11-02T10:00:00Z' })];
		expect(publishedPagesFor(records, 'cohort').map((p) => p.title)).toEqual(['New']);
	});
});
