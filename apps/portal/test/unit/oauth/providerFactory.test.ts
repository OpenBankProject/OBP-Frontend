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
function makeFakeStrategy(providerName: string, authEndpoint: string | undefined) {
	return {
		providerName,
		supports: (provider: string) => provider === providerName,
		getProviderName: () => providerName,
		async initialize(): Promise<OAuth2ClientWithConfig> {
			return {
				OIDCConfig: authEndpoint === undefined ? undefined : { authorization_endpoint: authEndpoint }
			} as unknown as OAuth2ClientWithConfig;
		}
	};
}

async function factoryWith(...strategies: Array<{ provider: string; authEndpoint: string | undefined }>) {
	const factory = new OAuth2ProviderFactory();
	for (const { provider, authEndpoint } of strategies) {
		factory.registerStrategy(makeFakeStrategy(provider, authEndpoint) as never);
		await factory.initializeProvider({ provider, url: 'https://well-known.example/config' });
	}
	return factory;
}

describe('OAuth2ProviderFactory trusted OIDC origins', () => {
	let factory: OAuth2ProviderFactory;

	beforeEach(() => {
		factory = new OAuth2ProviderFactory();
	});

	it('has no trusted origins and trusts no return url when empty', () => {
		expect(factory.getTrustedOidcOrigins().size).toBe(0);
		expect(factory.isTrustedOidcReturnUrl('https://idp.example.com/auth')).toBe(false);
	});

	it('trusts a candidate that shares the configured provider origin', async () => {
		const f = await factoryWith({ provider: 'fake-idp', authEndpoint: 'https://idp.example.com/auth' });
		expect(f.getTrustedOidcOrigins().has('https://idp.example.com')).toBe(true);
		expect(f.isTrustedOidcReturnUrl('https://idp.example.com/auth')).toBe(true);
	});

	it('trusts the same origin with a different path and query', async () => {
		const f = await factoryWith({ provider: 'fake-idp', authEndpoint: 'https://idp.example.com/auth' });
		expect(f.isTrustedOidcReturnUrl('https://idp.example.com/callback?state=abc')).toBe(true);
	});

	it('rejects a different port, scheme, or host', async () => {
		const f = await factoryWith({ provider: 'fake-idp', authEndpoint: 'https://idp.example.com/auth' });
		expect(f.isTrustedOidcReturnUrl('https://idp.example.com:8443/auth')).toBe(false);
		expect(f.isTrustedOidcReturnUrl('http://idp.example.com/auth')).toBe(false);
		expect(f.isTrustedOidcReturnUrl('https://evil.com/auth')).toBe(false);
	});

	it('collects origins from every configured provider', async () => {
		const f = await factoryWith(
			{ provider: 'fake-a', authEndpoint: 'https://a.example.com/auth' },
			{ provider: 'fake-b', authEndpoint: 'https://b.example.com/auth' }
		);
		const origins = f.getTrustedOidcOrigins();
		expect(origins.has('https://a.example.com')).toBe(true);
		expect(origins.has('https://b.example.com')).toBe(true);
		expect(origins.size).toBe(2);
	});

	it('deduplicates providers that share an origin', async () => {
		const f = await factoryWith(
			{ provider: 'fake-a', authEndpoint: 'https://shared.example.com/auth' },
			{ provider: 'fake-b', authEndpoint: 'https://shared.example.com/login' }
		);
		expect(f.getTrustedOidcOrigins().size).toBe(1);
	});

	it('skips a client whose OIDCConfig is undefined without throwing', async () => {
		const f = await factoryWith({ provider: 'fake-idp', authEndpoint: undefined });
		expect(f.getTrustedOidcOrigins().size).toBe(0);
		expect(f.isTrustedOidcReturnUrl('https://idp.example.com/auth')).toBe(false);
	});

	it('skips a malformed authorization_endpoint without throwing', async () => {
		const f = await factoryWith({ provider: 'fake-idp', authEndpoint: 'not a url' });
		expect(f.getTrustedOidcOrigins().size).toBe(0);
	});

	it('returns false for garbage candidate urls', async () => {
		const f = await factoryWith({ provider: 'fake-idp', authEndpoint: 'https://idp.example.com/auth' });
		expect(f.isTrustedOidcReturnUrl('::::')).toBe(false);
		expect(f.isTrustedOidcReturnUrl('')).toBe(false);
	});
});
