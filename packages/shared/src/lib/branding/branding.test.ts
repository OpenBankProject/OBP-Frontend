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
import { attr, colourClasses, cssColours, safeTheme, safeUrl, themeBranding, withBranding } from './index';

describe('branding', () => {
	it('accepts http(s) URLs and paths on the same site', () => {
		expect(safeUrl('https://cdn.example.com/brand.css', '/x')).toBe('https://cdn.example.com/brand.css');
		expect(safeUrl('/brand/logo.png', '/x')).toBe('/brand/logo.png');
	});

	it('refuses javascript:, data: and protocol-relative URLs', () => {
		expect(safeUrl('javascript:alert(1)', '/x')).toBe('/x');
		expect(safeUrl('data:text/css,body{}', '/x')).toBe('/x');
		expect(safeUrl('//evil.example.com/a.css', '/x')).toBe('/x');
	});

	it('accepts plain theme names only', () => {
		expect(safeTheme('bdih')).toBe('bdih');
		expect(safeTheme('a" onload="x')).toBe('obptheme');
	});

	it('escapes attribute values', () => {
		expect(attr('a"<b>&')).toBe('a&quot;&lt;b&gt;&amp;');
	});

	it('reads the prefixed environment variables, with defaults', () => {
		expect(themeBranding({}, 'PORTAL', '/favicon.png')).toEqual({ theme: 'obptheme', stylesheetUrl: '', faviconUrl: '/favicon.png' });
		expect(
			themeBranding(
				{ PORTAL_THEME: 'bdih', PORTAL_STYLESHEET_URL: 'https://brand.example.com/bdih.css', PORTAL_FAVICON_URL: '/brand/icon.png' },
				'PORTAL',
				'/favicon.png'
			)
		).toEqual({ theme: 'bdih', stylesheetUrl: 'https://brand.example.com/bdih.css', faviconUrl: '/brand/icon.png' });
		expect(themeBranding({ PORTAL_STYLESHEET_URL: 'javascript:x' }, 'PORTAL', '/favicon.png').stylesheetUrl).toBe('');
	});

	it('fills the branding placeholders of app.html', () => {
		const page = '<html data-theme="%branding.theme%"><link rel="icon" href="%branding.favicon%" />%branding.stylesheet%';
		expect(withBranding(page, { theme: 'bdih', stylesheetUrl: 'https://brand.example.com/a.css?x=1&y=2', faviconUrl: '/icon.png' })).toBe(
			'<html data-theme="bdih"><link rel="icon" href="/icon.png" /><link rel="stylesheet" href="https://brand.example.com/a.css?x=1&amp;y=2" />'
		);
		expect(withBranding(page, { theme: 'obptheme', stylesheetUrl: '', faviconUrl: '/favicon.png' })).toBe('<html data-theme="obptheme"><link rel="icon" href="/favicon.png" />');
	});

	it('finds classes that pick a colour themselves, but not the named styles or the button presets', () => {
		expect(colourClasses('p-2 text-surface-500 dark:bg-tertiary-900/30 hover:border-l-error-600')).toEqual(['text-surface-500', 'bg-tertiary-900', 'border-l-error-600']);
		expect(colourClasses('bg-surface-100 border-primary-200-800 preset-filled-tertiary-500 preset-tonal-error')).toEqual(['bg-surface-100', 'border-primary-200-800', 'preset-filled-tertiary-500', 'preset-tonal-error']);
		expect(colourClasses('ui-muted ui-tone-error preset-filled-primary-500 preset-tonal preset-outlined-surface-500 text-white')).toEqual([]);
	});

	it('finds colours written out in page CSS, but not the --ui-* variables or a black shadow', () => {
		const page = `<p style="color: #059669; margin: 0">x</p>\n<style>\n  .a { color: var(--ui-muted); border: 1px solid #e5e7eb; }\n  .b { background: rgb(var(--color-surface-800)); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }\n  .c { white-space: nowrap; fill: white; }\n</style>`;
		expect(cssColours(page)).toEqual(['border: #e5e7eb', 'background: var(--color-surface-800)', 'fill: white', 'color: #059669']);
	});
});
