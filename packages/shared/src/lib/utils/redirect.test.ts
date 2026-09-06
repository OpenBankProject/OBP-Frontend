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
import { isSafeRelativeRedirect } from './redirect';

describe('isSafeRelativeRedirect', () => {
	it('rejects null', () => {
		expect(isSafeRelativeRedirect(null)).toBe(false);
	});

	it('rejects undefined', () => {
		expect(isSafeRelativeRedirect(undefined)).toBe(false);
	});

	it('rejects an empty string', () => {
		expect(isSafeRelativeRedirect('')).toBe(false);
	});

	it('accepts a simple site-relative path', () => {
		expect(isSafeRelativeRedirect('/dashboard')).toBe(true);
	});

	it('accepts the root path', () => {
		expect(isSafeRelativeRedirect('/')).toBe(true);
	});

	it('accepts a relative path with query string', () => {
		expect(isSafeRelativeRedirect('/a/b?c=d')).toBe(true);
	});

	it('rejects a protocol-relative URL', () => {
		expect(isSafeRelativeRedirect('//evil.com')).toBe(false);
	});

	it('rejects a backslash-prefixed path that browsers resolve to another host', () => {
		expect(isSafeRelativeRedirect('/\\evil.com')).toBe(false);
	});

	it('rejects an absolute http(s) URL', () => {
		expect(isSafeRelativeRedirect('https://evil.com')).toBe(false);
	});

	it('rejects a path without a leading slash', () => {
		expect(isSafeRelativeRedirect('dashboard')).toBe(false);
	});
});
