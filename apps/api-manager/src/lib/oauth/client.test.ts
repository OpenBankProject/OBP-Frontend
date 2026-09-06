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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuth2Client } from 'arctic';
import { OAuth2ClientWithConfig } from './client';

// Build a JWT-shaped token (header.payload.signature) with a base64 payload.
function createMockJWT(payload: Record<string, unknown>): string {
	const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const body = btoa(JSON.stringify(payload));
	return `${header}.${body}.mock-signature`;
}

describe('OAuth2ClientWithConfig', () => {
	let client: OAuth2ClientWithConfig;

	beforeEach(() => {
		// arctic's OAuth2Client is globally mocked to return a plain object, which
		// would hijack `this` in the subclass constructor and strip its prototype
		// methods. Reset it to a no-op constructor so the real subclass instance is
		// built.
		vi.mocked(OAuth2Client).mockImplementation(function () {} as never);
		client = new OAuth2ClientWithConfig('id', 'secret', 'http://localhost/callback');
	});

	describe('constructor', () => {
		it('creates an instance exposing the custom methods', () => {
			expect(client.OIDCConfig).toBeUndefined();
			expect(typeof client.checkAccessTokenExpiration).toBe('function');
		});
	});

	describe('checkAccessTokenExpiration (fail closed)', () => {
		it('returns false for a token whose expiry is in the future', async () => {
			const token = createMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
			await expect(client.checkAccessTokenExpiration(token)).resolves.toBe(false);
		});

		it('returns true for an expired token', async () => {
			const token = createMockJWT({ exp: Math.floor(Date.now() / 1000) - 3600 });
			await expect(client.checkAccessTokenExpiration(token)).resolves.toBe(true);
		});

		it('treats a token without an exp claim as expired', async () => {
			const token = createMockJWT({ sub: 'user-1' });
			await expect(client.checkAccessTokenExpiration(token)).resolves.toBe(true);
		});

		it('treats an undecodable token as expired instead of throwing', async () => {
			await expect(client.checkAccessTokenExpiration('not.a.jwt')).resolves.toBe(true);
		});

		it('treats a malformed JWT payload as expired instead of throwing', async () => {
			await expect(
				client.checkAccessTokenExpiration('eyJhbGciOiJSUzI1NiJ9.invalid-payload.sig')
			).resolves.toBe(true);
		});
	});
});
