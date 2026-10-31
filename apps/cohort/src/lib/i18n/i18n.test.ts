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
import { dir, resolveLocale, t } from './index';
import { en } from './en';
import { ar } from './ar';

describe('resolveLocale', () => {
	it('prefers the cookie', () => {
		expect(resolveLocale('ar', 'en-GB,en;q=0.9')).toBe('ar');
	});
	it('falls back to Accept-Language', () => {
		expect(resolveLocale(undefined, 'ar-OM,ar;q=0.9,en;q=0.8')).toBe('ar');
	});
	it('ignores an unsupported cookie and language', () => {
		expect(resolveLocale('fr', 'fr-FR')).toBe('en');
	});
});

describe('dir', () => {
	it('is rtl for Arabic', () => {
		expect(dir('ar')).toBe('rtl');
		expect(dir('en')).toBe('ltr');
	});
});

describe('messages', () => {
	it('has an Arabic text for every English key', () => {
		expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
	});
	it('falls back to English', () => {
		expect(t('ar', 'home_heading')).toBe(ar.home_heading);
		expect(t('en', 'home_heading')).toBe(en.home_heading);
	});
});
