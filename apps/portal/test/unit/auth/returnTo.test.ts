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
import { safeReturnPath, loginUrlReturningTo } from '$lib/server/auth/returnTo';

describe('safeReturnPath', () => {
	it('keeps a path on this site, with its query', () => {
		expect(safeReturnPath('/consumers/register')).toBe('/consumers/register');
		expect(safeReturnPath('/user/consents?status=ACCEPTED')).toBe('/user/consents?status=ACCEPTED');
	});

	it('refuses anything that could leave the site', () => {
		for (const raw of ['https://evil.example/x', '//evil.example/x', '/\\evil.example/x', 'evil.example', 'javascript:alert(1)', '/%2F%2Fevil.example']) {
			const safe = safeReturnPath(raw);
			if (safe !== null) expect(safe.startsWith('//')).toBe(false);
			expect(safe === null || safe.startsWith('/')).toBe(true);
		}
		expect(safeReturnPath('https://evil.example/x')).toBeNull();
		expect(safeReturnPath('//evil.example/x')).toBeNull();
		expect(safeReturnPath('/\\evil.example/x')).toBeNull();
	});

	it('refuses the home page and the login and logout pages', () => {
		expect(safeReturnPath('/')).toBeNull();
		expect(safeReturnPath('/login?return_to=/x')).toBeNull();
		expect(safeReturnPath('/logout')).toBeNull();
		expect(safeReturnPath('')).toBeNull();
		expect(safeReturnPath(null)).toBeNull();
	});
});

describe('loginUrlReturningTo', () => {
	it('carries the page in return_to', () => {
		expect(loginUrlReturningTo('/consumers/register')).toBe('/login?return_to=%2Fconsumers%2Fregister');
	});
	it('is plain /login when there is nowhere to return to', () => {
		expect(loginUrlReturningTo('/')).toBe('/login');
	});
});
