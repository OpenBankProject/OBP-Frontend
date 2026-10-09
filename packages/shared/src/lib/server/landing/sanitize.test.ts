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
import { sanitizePageHtml, sanitizeContentHtml } from './sanitize.js';

// Payloads that get past a regex blocklist (stripActiveContent); the allowlist must stop them.
const BYPASSES = [
	'<a href="java&#x73;cript:alert(1)">x</a>',
	'<a href="&#106;avascript:alert(1)">x</a>',
	'<img src="x"/onerror=alert(1)>',
	'<a href=" javascript:alert(1)">x</a>',
	'<svg><a xlink:href="javascript:alert(1)">x</a></svg>',
	'<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>'
];

function isInert(html: string) {
	expect(html).not.toMatch(/javascript:/i);
	expect(html).not.toMatch(/\son[a-z]+\s*=/i);
	expect(html).not.toMatch(/<(script|iframe|svg|math)\b/i);
}

describe.each([
	['sanitizePageHtml', sanitizePageHtml],
	['sanitizeContentHtml', sanitizeContentHtml]
])('%s', (_name, sanitize) => {
	it.each(BYPASSES)('neutralises %s', (payload) => {
		isInert(sanitize(payload));
	});

	it('keeps ordinary content', () => {
		const html = '<h2>T</h2><p>a <strong>b</strong> <a href="https://x.example/y">c</a></p><ul><li>d</li></ul><pre><code>e</code></pre>';
		expect(sanitize(html)).toBe(html);
	});

	it('keeps non-URL attributes such as width and colspan', () => {
		const html = '<table><tbody><tr><td colspan="2"><img src="/a.png" alt="a" width="3"></td></tr></tbody></table>';
		expect(sanitize(html)).toBe(html);
	});

	it('drops protocol-relative and non-http URLs', () => {
		expect(sanitize('<a href="//evil.example">a</a><a href="data:text/html,x">b</a><img src="ftp://x/y">')).toBe('<a>a</a><a>b</a><img>');
	});

	it('gives target=_blank links rel=noopener noreferrer', () => {
		expect(sanitize('<a href="https://x.example" target="_blank">x</a>')).toContain('rel="noopener noreferrer"');
	});
});

describe('sanitizePageHtml', () => {
	it('keeps style, live tags and behaviour attributes', () => {
		const out = sanitizePageHtml('<style>.a{color:red}</style><div data-behaviour="tabs"><p>x</p></div>');
		expect(out).toContain('<style>');
		expect(out).toContain('data-behaviour="tabs"');
	});
});

describe('sanitizeContentHtml', () => {
	it('drops style elements and attributes', () => {
		expect(sanitizeContentHtml('<style>body{display:none}</style><p style="position:fixed">x</p>')).toBe('<p>x</p>');
	});
});
