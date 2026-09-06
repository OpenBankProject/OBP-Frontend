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
import { stripActiveContent } from './strip.js';

describe('stripActiveContent', () => {
	it('removes script elements including their content', () => {
		expect(stripActiveContent('<p>a</p><script>alert(1)</script><p>b</p>')).toBe('<p>a</p><p>b</p>');
		expect(stripActiveContent('<SCRIPT type="module">x</SCRIPT>')).toBe('');
		expect(stripActiveContent('<script src="https://x/y.js">')).toBe('');
	});

	it('removes frames, objects, links, meta and svg', () => {
		const html = '<link rel="stylesheet" href="x"><meta http-equiv="refresh" content="0"><iframe src="x"></iframe><object data="x"></object><svg onload="x()"></svg><p>ok</p>';
		expect(stripActiveContent(html)).toBe('<p>ok</p>');
	});

	it('strips inline event handlers but keeps other attributes', () => {
		expect(stripActiveContent('<a href="/x" onclick="steal()" class="c" onmouseover=\'y()\'>t</a>')).toBe('<a href="/x" class="c">t</a>');
		expect(stripActiveContent('<img src="/i.png" onerror=alert(1)>')).toBe('<img src="/i.png">');
	});

	it('neutralises javascript: and data: urls', () => {
		expect(stripActiveContent('<a href="javascript:alert(1)">x</a>')).toBe('<a href="#">x</a>');
		expect(stripActiveContent("<a href=' JavaScript:alert(1)'>x</a>")).toBe('<a href="#">x</a>');
		expect(stripActiveContent('<img src="data:text/html,hi">')).toBe('<img src="#">');
		expect(stripActiveContent('<a href="https://ok">x</a>')).toBe('<a href="https://ok">x</a>');
	});

	it('leaves styles, data-behaviour attributes and live tags alone', () => {
		const html = '<style>.a{color:red}</style><div data-behaviour="tabs" data-until="2026-10-12T09:00:00Z"><obp-products tag="x"></obp-products></div>';
		expect(stripActiveContent(html)).toBe(html);
	});

	it('removes css imports and expressions', () => {
		expect(stripActiveContent('<style>@import url(https://x/a.css); .a{width:expression(1)}</style>')).toBe('<style> .a{width:blocked(1)}</style>');
	});
});
