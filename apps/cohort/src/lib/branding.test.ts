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
import { attr, safeTheme, safeUrl } from './branding';

describe('branding values', () => {
	it('accepts http(s) URLs and paths on this site', () => {
		expect(safeUrl('https://cdn.example.com/logo.svg', '/x')).toBe('https://cdn.example.com/logo.svg');
		expect(safeUrl('/brand/logo.png', '/x')).toBe('/brand/logo.png');
	});

	it('refuses other URLs', () => {
		expect(safeUrl('javascript:alert(1)', '/x')).toBe('/x');
		expect(safeUrl('data:image/png;base64,AAAA', '/x')).toBe('/x');
		expect(safeUrl('//evil.example.com/a.css', '/x')).toBe('/x');
	});

	it('accepts only plain theme names', () => {
		expect(safeTheme('mybrand')).toBe('mybrand');
		expect(safeTheme('a" onload="x')).toBe('obptheme');
	});

	it('escapes attribute values', () => {
		expect(attr('a"b<c')).toBe('a&quot;b&lt;c');
	});
});
