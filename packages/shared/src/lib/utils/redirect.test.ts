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
import { safeInternalPath } from './redirect';

describe('safeInternalPath', () => {
	it('keeps a path on this site, with its query and fragment', () => {
		expect(safeInternalPath('/')).toBe('/');
		expect(safeInternalPath('/dashboard')).toBe('/dashboard');
		expect(safeInternalPath('/consumers?x=1')).toBe('/consumers?x=1');
		expect(safeInternalPath('/a/b?c=d#e')).toBe('/a/b?c=d#e');
	});

	it('returns the normalised path, not the original', () => {
		expect(safeInternalPath('/a/../b')).toBe('/b');
	});

	it('refuses empty values', () => {
		expect(safeInternalPath(null)).toBeNull();
		expect(safeInternalPath(undefined)).toBeNull();
		expect(safeInternalPath('')).toBeNull();
	});

	it('refuses every value a browser could resolve to another host', () => {
		for (const raw of [
			'/\t/evil.com',
			'/\n/evil.com',
			'/\r/evil.com',
			'//evil.com',
			'/\\evil.com',
			'/.//evil.com',
			'/a/..//evil.com',
			'/%2e//evil.com',
			'https://evil.com',
			'javascript:alert(1)',
			'dashboard',
			'evil.com'
		]) {
			expect(safeInternalPath(raw), JSON.stringify(raw)).toBeNull();
		}
	});

	it('never returns a value starting with two slashes', () => {
		for (const raw of ['/%2F%2Fevil.com', '/./', '/a/./b', '/%2e%2e//evil.com']) {
			const safe = safeInternalPath(raw);
			expect(safe === null || !safe.startsWith('//'), JSON.stringify(raw)).toBe(true);
		}
	});
});
