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
import { LOGIN_ERRORS, loginErrorUrl, parseLoginError } from './loginErrors';
import { en } from '$lib/i18n/en';

describe('login errors', () => {
	it('accepts only known codes', () => {
		expect(parseLoginError('invalid_state')).toBe('invalid_state');
		expect(parseLoginError('<script>')).toBeNull();
		expect(parseLoginError(null)).toBeNull();
	});
	it('puts only the code in the URL', () => {
		expect(loginErrorUrl('login_failed')).toBe('/login?error=login_failed');
	});
	it('has a message for every code', () => {
		for (const code of LOGIN_ERRORS) expect(en).toHaveProperty(`login_error_${code}`);
	});
});
