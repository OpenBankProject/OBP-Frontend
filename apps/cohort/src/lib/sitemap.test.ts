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
import { buildSitemap, PAGES, routeOf } from './sitemap';

const files = Object.keys(import.meta.glob('/src/routes/**/+page.svelte'));

describe('sitemap', () => {
	it('reads the address of a route file', () => {
		expect(routeOf('/src/routes/(protected)/staff/calls/[id]/+page.svelte')).toEqual({ route: '/staff/calls/[id]', login: true });
		expect(routeOf('/src/routes/(public)/+page.svelte')).toEqual({ route: '/', login: false });
	});

	it('describes every page, and no page that is gone', () => {
		const routes = files.map((f) => routeOf(f).route).sort();
		expect(routes).toEqual(Object.keys(PAGES).sort());
	});

	it('nests pages under the page whose address starts theirs, by audience', () => {
		const map = buildSitemap([
			'/src/routes/(public)/+page.svelte',
			'/src/routes/(public)/calls/[id]/+page.svelte',
			'/src/routes/(protected)/calls/[id]/details/+page.svelte',
			'/src/routes/(protected)/staff/+page.svelte',
			'/src/routes/(protected)/staff/calls/[id]/+page.svelte',
			'/src/routes/(protected)/staff/calls/[id]/edit/+page.svelte'
		]);
		expect(map.everyone.map((p) => p.route)).toEqual(['/', '/calls/[id]']);
		expect(map.applicants.map((p) => p.route)).toEqual(['/calls/[id]/details']);
		expect(map.staff[0].children[0].route).toBe('/staff/calls/[id]');
		expect(map.staff[0].children[0].children[0]).toMatchObject({ route: '/staff/calls/[id]/edit', dynamic: true, login: true });
	});
});
