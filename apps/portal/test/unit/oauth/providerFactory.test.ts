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
import { mockEnvironment } from '../../fixtures/oauth';

// providerFactory.ts reads $env/dynamic/private at import time; the server test
// setup does not mock $env, so provide it here.
vi.mock('$env/dynamic/private', () => ({ env: mockEnvironment }));

import { OAuth2ProviderFactory } from '$lib/oauth/providerFactory';
import type { OAuth2ClientWithConfig } from '$lib/oauth/client';

// A strategy the built-in keycloak/obp-oidc/google strategies never match, whose
// initialize() returns a client with a pre-baked OIDCConfig and performs no fetch.
function makeFakeStrategy(providerName: string, issuer: string | undefined) {
	return {
		providerName,
		supports: (provider: string) => provider === providerName,
		getProviderName: () => providerName,
		async initialize(): Promise<OAuth2ClientWithConfig> {
			return {
				OIDCConfig: issuer === undefined ? undefined : { issuer, authorization_endpoint: `${issuer}/auth` }
			} as unknown as OAuth2ClientWithConfig;
		}
	};
}

async function factoryWith(...strategies: Array<{ provider: string; issuer: string | undefined }>) {
	const factory = new OAuth2ProviderFactory();
	for (const { provider, issuer } of strategies) {
		factory.registerStrategy(makeFakeStrategy(provider, issuer) as never);
		await factory.initializeProvider({ provider, url: 'https://well-known.example/config' });
	}
	return factory;
}

const ISSUER = 'https://idp.example.com/obp-oidc';
const CALLBACK = 'https://idp.example.com/obp-oidc/consent-callback';

describe('OAuth2ProviderFactory trusted OIDC return endpoints', () => {
	let factory: OAuth2ProviderFactory;

	beforeEach(() => {
		factory = new OAuth2ProviderFactory();
	});

	it('trusts no return url when no provider is configured', () => {
		expect(factory.getTrustedOidcReturnEndpoints().size).toBe(0);
		expect(factory.isTrustedOidcReturnUrl(CALLBACK)).toBe(false);
	});

	it("trusts the provider's consent-callback endpoint, with any challenge in the query", async () => {
		const f = await factoryWith({ provider: 'fake-idp', issuer: ISSUER });
		expect(f.getTrustedOidcReturnEndpoints().has(CALLBACK)).toBe(true);
		expect(f.isTrustedOidcReturnUrl(CALLBACK)).toBe(true);
		expect(f.isTrustedOidcReturnUrl(`${CALLBACK}?challenge=abc`)).toBe(true);
	});

	it('copes with a trailing slash on the issuer', async () => {
		const f = await factoryWith({ provider: 'fake-idp', issuer: `${ISSUER}/` });
		expect(f.isTrustedOidcReturnUrl(`${CALLBACK}?challenge=abc`)).toBe(true);
	});

	it("refuses any other path on the provider's host", async () => {
		const f = await factoryWith({ provider: 'fake-idp', issuer: ISSUER });
		for (const candidate of [
			'https://idp.example.com/obp-oidc/auth',
			'https://idp.example.com/callback?state=abc',
			'https://idp.example.com/obp-oidc/consent-callback/extra',
			'https://idp.example.com/obp-oidc/consent-callbackx'
		]) {
			expect(f.isTrustedOidcReturnUrl(candidate), candidate).toBe(false);
		}
	});

	it('refuses a different port, scheme or host, user information and a fragment', async () => {
		const f = await factoryWith({ provider: 'fake-idp', issuer: ISSUER });
		for (const candidate of [
			'https://idp.example.com:8443/obp-oidc/consent-callback',
			'http://idp.example.com/obp-oidc/consent-callback',
			'https://evil.com/obp-oidc/consent-callback',
			'https://user@idp.example.com/obp-oidc/consent-callback',
			'https://idp.example.com/obp-oidc/consent-callback#x'
		]) {
			expect(f.isTrustedOidcReturnUrl(candidate), candidate).toBe(false);
		}
	});

	it('collects the endpoint of every configured provider', async () => {
		const f = await factoryWith(
			{ provider: 'fake-a', issuer: 'https://a.example.com' },
			{ provider: 'fake-b', issuer: 'https://b.example.com/realms/obp' }
		);
		const endpoints = f.getTrustedOidcReturnEndpoints();
		expect(endpoints.has('https://a.example.com/consent-callback')).toBe(true);
		expect(endpoints.has('https://b.example.com/realms/obp/consent-callback')).toBe(true);
		expect(endpoints.size).toBe(2);
	});

	it('skips a client whose OIDCConfig is undefined without throwing', async () => {
		const f = await factoryWith({ provider: 'fake-idp', issuer: undefined });
		expect(f.getTrustedOidcReturnEndpoints().size).toBe(0);
		expect(f.isTrustedOidcReturnUrl(CALLBACK)).toBe(false);
	});

	it('skips a malformed issuer without throwing', async () => {
		const f = await factoryWith({ provider: 'fake-idp', issuer: 'not a url' });
		expect(f.getTrustedOidcReturnEndpoints().size).toBe(0);
	});

	it('returns false for garbage candidate urls', async () => {
		const f = await factoryWith({ provider: 'fake-idp', issuer: ISSUER });
		expect(f.isTrustedOidcReturnUrl('::::')).toBe(false);
		expect(f.isTrustedOidcReturnUrl('')).toBe(false);
	});
});
