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
import { tppRedirectsOf } from '$lib/server/bgConsentRedirects';

// A consent as OBP-API returns it: the request headers live in the JWT payload as [{name, values}].
function consentWithHeaders(headers: Record<string, string>) {
	const payload = { request_headers: Object.entries(headers).map(([name, value]) => ({ name, values: [value] })) };
	const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
	return { jwt: `${encode({ alg: 'none' })}.${encode(payload)}.signature` };
}

describe('tppRedirectsOf', () => {
	it('reads both addresses from the consent', () => {
		const redirects = tppRedirectsOf(consentWithHeaders({
			'TPP-Redirect-URI': 'https://tpp.example/ok',
			'TPP-Nok-Redirect-URI': 'https://tpp.example/nok'
		}));
		expect(redirects.tppRedirectUri).toBe('https://tpp.example/ok');
		expect(redirects.nokRedirectUri).toBe('https://tpp.example/nok');
		expect(redirects.tppRedirectUriProblem).toBeNull();
	});

	it('uses TPP-Redirect-URI after a refusal when no TPP-Nok-Redirect-URI was sent', () => {
		const redirects = tppRedirectsOf(consentWithHeaders({ 'TPP-Redirect-URI': 'com.example.tppapp://ok' }));
		expect(redirects.nokRedirectUri).toBe('com.example.tppapp://ok');
	});

	it('never offers an address that breaks the redirect URL rules', () => {
		const redirects = tppRedirectsOf(consentWithHeaders({
			'TPP-Redirect-URI': 'javascript:alert(1)',
			'TPP-Nok-Redirect-URI': 'http://tpp.example/nok'
		}));
		expect(redirects.tppRedirectUri).toBe('');
		expect(redirects.nokRedirectUri).toBe('');
		expect(redirects.tppRedirectUriProblem).not.toBeNull();
	});

	it('copes with a consent without a usable JWT', () => {
		expect(tppRedirectsOf({ jwt: 'not-a-jwt' })).toEqual({ tppRedirectUri: '', nokRedirectUri: '', tppRedirectUriProblem: null });
		expect(tppRedirectsOf(null).tppRedirectUri).toBe('');
	});
});
