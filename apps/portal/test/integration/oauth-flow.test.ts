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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockEnvironment } from '../fixtures/oauth';

// providerFactory.ts reads $env/dynamic/private at import time; the server test
// setup does not mock $env, so provide it here.
vi.mock('$env/dynamic/private', () => ({ env: mockEnvironment }));

import { OAuth2ProviderFactory, oauth2ProviderFactory } from '$lib/oauth/providerFactory';
import { SessionOAuthHelper } from '$lib/oauth/sessionHelper';
import type { OAuth2ClientWithConfig } from '$lib/oauth/client';
import { createMockSession, restoreAllMocks } from '../helpers';

const WELL_KNOWN = 'https://idp.example.com/.well-known/openid-configuration';
const AUTH_ENDPOINT = 'https://idp.example.com/protocol/openid-connect/auth';
const TOKEN_ENDPOINT = 'https://idp.example.com/protocol/openid-connect/token';

// A hand-built client that exposes exactly the two fields the production code
// reads: OIDCConfig (for the token endpoint / trusted origins) and a
// refreshAccessToken function we control. Building it by hand sidesteps the
// globally-mocked arctic OAuth2Client and performs no network I/O.
function makeFakeClient(refreshAccessToken: ReturnType<typeof vi.fn> = vi.fn()) {
	return {
		OIDCConfig: {
			authorization_endpoint: AUTH_ENDPOINT,
			token_endpoint: TOKEN_ENDPOINT
		},
		refreshAccessToken
	} as unknown as OAuth2ClientWithConfig;
}

// A strategy the built-in keycloak/obp-oidc/google strategies never match, whose
// initialize() returns a pre-baked client and performs no fetch.
function makeFakeStrategy(providerName: string, initialize: () => Promise<OAuth2ClientWithConfig>) {
	return {
		providerName,
		supports: (provider: string) => provider === providerName,
		getProviderName: () => providerName,
		initialize
	};
}

// SessionOAuthHelper resolves its client from the shared singleton factory, so the
// refresh path is integration-tested against that singleton. 'fake-idp' is matched
// by no built-in strategy, so registering + initializing it exercises the real
// registerStrategy -> initializeProvider -> getClient path. A closure-held client
// lets each test supply a fresh, controllable client through that same real path.
const fakeIdpHolder: { client?: OAuth2ClientWithConfig } = {};

async function primeFakeIdp(client: OAuth2ClientWithConfig): Promise<void> {
	fakeIdpHolder.client = client;
	if (!oauth2ProviderFactory.getStrategy('fake-idp')) {
		oauth2ProviderFactory.registerStrategy(
			makeFakeStrategy('fake-idp', async () => fakeIdpHolder.client!) as never
		);
	}
	await oauth2ProviderFactory.initializeProvider({ provider: 'fake-idp', url: WELL_KNOWN });
}

function primeGoogle(client: OAuth2ClientWithConfig): void {
	// The built-in GoogleStrategy already claims 'google' and would try to construct
	// a real client from unset GOOGLE_* env, so seed the initialized-client map
	// directly to keep control while still driving the real getClient() lookup.
	(
		oauth2ProviderFactory as unknown as {
			initializedClients: Map<string, OAuth2ClientWithConfig>;
		}
	).initializedClients.set('google', client);
}

function clearSingletonClients(): void {
	(
		oauth2ProviderFactory as unknown as {
			initializedClients: Map<string, OAuth2ClientWithConfig>;
		}
	).initializedClients.clear();
}

describe('OAuth Flow Integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// The singleton retains state between tests; reset it so each test is independent.
		clearSingletonClients();
	});

	afterEach(() => {
		restoreAllMocks();
	});

	describe('Provider factory registration', () => {
		it('registers a fake provider and exposes its client and origins', async () => {
			const factory = new OAuth2ProviderFactory();
			const client = makeFakeClient();

			factory.registerStrategy(makeFakeStrategy('fake-idp', async () => client) as never);
			const initialized = await factory.initializeProvider({ provider: 'fake-idp', url: WELL_KNOWN });

			expect(initialized).toBe(client);
			expect(factory.hasAnyClients()).toBe(true);
			expect(factory.getClient('fake-idp')).toBe(client);
			expect(factory.getFirstAvailableProvider()).toBe('fake-idp');

			expect(factory.getTrustedOidcOrigins().has('https://idp.example.com')).toBe(true);
			expect(factory.isTrustedOidcReturnUrl('https://idp.example.com/callback?state=abc')).toBe(true);
			expect(factory.isTrustedOidcReturnUrl('https://evil.example.com/callback')).toBe(false);
		});

		it('returns null and stores no client for an unknown provider', async () => {
			const factory = new OAuth2ProviderFactory();

			const initialized = await factory.initializeProvider({
				provider: 'not-registered',
				url: WELL_KNOWN
			});

			expect(initialized).toBeNull();
			expect(factory.hasAnyClients()).toBe(false);
			expect(factory.getFirstAvailableProvider()).toBeNull();
		});
	});

	describe('Session token refresh via the shared factory', () => {
		it('resolves the client and tokens from the singleton factory', async () => {
			const client = makeFakeClient();
			await primeFakeIdp(client);

			const session = createMockSession({
				oauth: {
					provider: 'fake-idp',
					access_token: 'access-token-1',
					refresh_token: 'refresh-token-1',
					id_token: 'id-token-1'
				}
			});

			const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session as never);

			expect(sessionOAuth).not.toBeNull();
			expect(sessionOAuth?.client).toBe(client);
			expect(sessionOAuth?.provider).toBe('fake-idp');
			expect(sessionOAuth?.accessToken).toBe('access-token-1');
			expect(sessionOAuth?.refreshToken).toBe('refresh-token-1');
			expect(sessionOAuth?.idToken).toBe('id-token-1');
		});

		it('refreshes and saves the updated tokens for a standard provider', async () => {
			const refresh = vi.fn().mockResolvedValue({
				accessToken: () => 'new-access-token',
				refreshToken: () => 'new-refresh-token',
				idToken: () => 'new-id-token'
			});
			const client = makeFakeClient(refresh);
			await primeFakeIdp(client);

			const session = createMockSession({
				oauth: {
					provider: 'fake-idp',
					access_token: 'old-access-token',
					refresh_token: 'old-refresh-token',
					id_token: 'old-id-token'
				}
			});

			await SessionOAuthHelper.refreshAccessToken(session as never);

			expect(refresh).toHaveBeenCalledWith(TOKEN_ENDPOINT, 'old-refresh-token', ['openid']);
			expect(session.data.oauth.access_token).toBe('new-access-token');
			expect(session.data.oauth.refresh_token).toBe('new-refresh-token');
			expect(session.data.oauth.id_token).toBe('new-id-token');
			expect(session.data.oauth.provider).toBe('fake-idp');
			expect(session.save).toHaveBeenCalled();
		});

		it('stores the id token as the access token for the google provider', async () => {
			const refresh = vi.fn().mockResolvedValue({
				// Google access tokens are opaque; OBP verifies the id_token JWT instead.
				accessToken: () => 'opaque-google-access-token',
				refreshToken: () => 'new-refresh-token',
				idToken: () => 'google-id-jwt'
			});
			const client = makeFakeClient(refresh);
			primeGoogle(client);

			const session = createMockSession({
				oauth: {
					provider: 'google',
					access_token: 'old-access-token',
					refresh_token: 'old-refresh-token'
				}
			});

			await SessionOAuthHelper.refreshAccessToken(session as never);

			expect(refresh).toHaveBeenCalledWith(TOKEN_ENDPOINT, 'old-refresh-token', ['openid']);
			expect(session.data.oauth.access_token).toBe('google-id-jwt');
			expect(session.data.oauth.id_token).toBe('google-id-jwt');
			expect(session.data.oauth.refresh_token).toBe('new-refresh-token');
			expect(session.save).toHaveBeenCalled();
		});

		it('keeps the existing tokens when the refresh response omits them', async () => {
			const refresh = vi.fn().mockResolvedValue({
				accessToken: () => 'rotated-access-token',
				refreshToken: () => undefined,
				idToken: () => undefined
			});
			const client = makeFakeClient(refresh);
			await primeFakeIdp(client);

			const session = createMockSession({
				oauth: {
					provider: 'fake-idp',
					access_token: 'old-access-token',
					refresh_token: 'kept-refresh-token',
					id_token: 'kept-id-token'
				}
			});

			await SessionOAuthHelper.refreshAccessToken(session as never);

			expect(session.data.oauth.access_token).toBe('rotated-access-token');
			expect(session.data.oauth.refresh_token).toBe('kept-refresh-token');
			expect(session.data.oauth.id_token).toBe('kept-id-token');
			expect(session.save).toHaveBeenCalled();
		});

		it('throws and does not save when the client refresh fails', async () => {
			const refresh = vi.fn().mockRejectedValue(new Error('token endpoint returned 400'));
			const client = makeFakeClient(refresh);
			await primeFakeIdp(client);

			const session = createMockSession({
				oauth: {
					provider: 'fake-idp',
					access_token: 'old-access-token',
					refresh_token: 'old-refresh-token'
				}
			});

			await expect(SessionOAuthHelper.refreshAccessToken(session as never)).rejects.toThrow(
				'Failed to refresh access token. Please log in again.'
			);

			expect(session.data.oauth.access_token).toBe('old-access-token');
			expect(session.save).not.toHaveBeenCalled();
		});

		it('throws when the session has no OAuth data', async () => {
			const session = createMockSession({});

			await expect(SessionOAuthHelper.refreshAccessToken(session as never)).rejects.toThrow(
				'No valid OAuth data found in session. Please log in again.'
			);
		});
	});
});
