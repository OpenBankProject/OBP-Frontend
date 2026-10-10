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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildLandingFetchers } from './fetchers.js';
import { sanitizePageHtml } from './sanitize.js';
import { clearGlossaryCache } from '../explorer/glossaryCache.js';
import { expandLiveTags } from '../../landing/expand.js';

const ITEMS = [
	{
		title: 'Consent',
		description: { markdown: 'A **Consent**. See [Views](/glossary#Views).', html: '' },
		is_dynamic: false,
		overrides_static_item: false
	},
	{ title: 'Views', description: { markdown: 'Views.', html: '' }, is_dynamic: false, overrides_static_item: false },
	{
		title: 'Evil',
		// Raw HTML is escaped by markdown-it; the link scheme is refused by markdown-it and the sanitiser.
		description: { markdown: '<img src=x onerror=alert(1)> [x](javascript:alert(1))', html: '' },
		is_dynamic: true,
		overrides_static_item: false
	}
];

const links = { portalUrl: 'https://portal.example', explorerUrl: '', obpBaseUrl: 'https://obp.example' };

describe('landing glossary fetcher', () => {
	beforeEach(() => {
		clearGlossaryCache();
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify({ glossary_items: ITEMS }), { status: 200 }))
		);
	});

	it('renders the item, pointing links between items at the Portal glossary', async () => {
		const entry = await buildLandingFetchers(async () => ({}), undefined, links).glossary('consent');
		expect(entry?.title).toBe('Consent');
		expect(entry?.sanitisedHtml).toContain('<strong>Consent</strong>');
		expect(entry?.sanitisedHtml).toContain('href="https://portal.example/api-explorer/glossary/Views"');
		expect(entry?.excerpt).toBe('A Consent. See Views.');
	});

	it('hands over inert HTML for a hostile dynamic item', async () => {
		const entry = await buildLandingFetchers(async () => ({}), undefined, links).glossary('Evil');
		// Escaped as text: no element, no handler, no link.
		expect(entry?.sanitisedHtml).toContain('&lt;img src=x onerror=alert(1)&gt;');
		expect(entry?.sanitisedHtml).not.toMatch(/<img|<a\b|href=/i);
	});

	it('is undefined for an unknown title', async () => {
		expect(await buildLandingFetchers(async () => ({}), undefined, links).glossary('Nope')).toBeUndefined();
	});

	it('survives the page sanitiser and expands in a page', async () => {
		const source = '<div><obp-glossary title="Consent" mode="summary"></obp-glossary></div>';
		const out = await expandLiveTags(sanitizePageHtml(source), buildLandingFetchers(async () => ({}), undefined, links));
		expect(out).toContain('<p class="obp-glossary-excerpt">A Consent. See Views.</p>');
		expect(out).toContain('href="https://portal.example/api-explorer/glossary/Consent"');
	});
});
