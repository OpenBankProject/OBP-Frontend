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
import { describe, it, expect } from 'vitest';
import { renderWebUiProp } from './webUiProp';

describe('renderWebUiProp', () => {
	it('renders markdown by default', () => {
		const html = renderWebUiProp('webui_welcome_description', 'Read **this**.\n\n- one\n- two');
		expect(html).toContain('<strong>this</strong>');
		expect(html).toContain('<li>one</li>');
		expect(html).toContain('<p>');
	});

	it('renders only inline markdown when inline', () => {
		expect(renderWebUiProp('webui_welcome_title', 'Hello *there*', { inline: true })).toBe('Hello <em>there</em>');
	});

	it('opens http(s) links in a new tab and keeps relative links in place', () => {
		const html = renderWebUiProp('webui_welcome_description', '[docs](https://example.com) [register](/register)', {
			inline: true,
			linkClass: 'underline'
		});
		expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer" class="underline">docs</a>');
		expect(html).toContain('<a href="/register" class="underline">register</a>');
	});

	it('escapes raw HTML and refuses javascript: links', () => {
		const html = renderWebUiProp('webui_welcome_description', '<script>alert(1)</script> [x](javascript:alert(1))');
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
		expect(html).not.toContain('href="javascript:');
	});

	it('escapes props in WEB_UI_PROPS_NOT_MARKDOWN instead of parsing them', () => {
		expect(renderWebUiProp('webui_support_platform_url', 'https://chat.example.com/a_b_c?x=<y>')).toBe(
			'https://chat.example.com/a_b_c?x=&lt;y&gt;'
		);
	});
});
