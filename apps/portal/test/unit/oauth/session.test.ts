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
import { mockEnvironment, mockAccessToken, mockRefreshToken } from '../../fixtures/oauth';
import { createMockSession, restoreAllMocks } from '../../helpers';

// sessionHelper -> providerFactory reads $env/dynamic/private at import time; the
// server test setup does not mock $env, so provide it here before importing units.
vi.mock('$env/dynamic/private', () => ({ env: mockEnvironment }));

import { SessionOAuthHelper } from '$lib/oauth/sessionHelper';
import { oauth2ProviderFactory } from '$lib/oauth/providerFactory';
import type { OAuth2ClientWithConfig } from '$lib/oauth/client';

// The refresh path resolves the client from oauth2ProviderFactory.getClient(provider).
// Register a hand-built client directly into the singleton factory so we fully control
// its OIDCConfig and refreshAccessToken behaviour, with no network calls.
const TOKEN_ENDPOINT =
	'https://test-oauth2.openbankproject.com/realms/obp-test/protocol/openid-connect/token';

interface FakeTokens {
	accessToken: () => string;
	refreshToken: () => string | null;
	idToken: () => string | undefined;
}

function registerFakeClient(
	provider: string,
	options: {
		tokenEndpoint?: string | undefined;
		omitOIDCConfig?: boolean;
		refresh?: () => Promise<FakeTokens>;
	} = {}
): { client: OAuth2ClientWithConfig; refreshAccessToken: ReturnType<typeof vi.fn> } {
	const refreshAccessToken = vi.fn(
		options.refresh ?? (async () => makeTokens('unused', null, undefined))
	);

	const client = {
		OIDCConfig: options.omitOIDCConfig
			? undefined
			: { token_endpoint: options.tokenEndpoint },
		refreshAccessToken
	} as unknown as OAuth2ClientWithConfig;

	// getClient(provider) simply reads the private initializedClients map by key.
	(oauth2ProviderFactory as unknown as { initializedClients: Map<string, OAuth2ClientWithConfig> })
		.initializedClients.set(provider, client);

	return { client, refreshAccessToken };
}

function makeTokens(
	accessToken: string,
	refreshToken: string | null,
	idToken: string | undefined
): FakeTokens {
	return {
		accessToken: () => accessToken,
		refreshToken: () => refreshToken,
		idToken: () => idToken
	};
}

function clearFactoryClients() {
	(oauth2ProviderFactory as unknown as { initializedClients: Map<string, unknown> })
		.initializedClients.clear();
}

describe('SessionOAuthHelper', () => {
	afterEach(() => {
		clearFactoryClients();
		restoreAllMocks();
	});

	describe('getSessionOAuth', () => {
		it('returns null when session oauth has no provider', () => {
			const session = createMockSession({
				oauth: { access_token: mockAccessToken, refresh_token: mockRefreshToken }
			});

			expect(SessionOAuthHelper.getSessionOAuth(session as never)).toBeNull();
		});

		it('returns null when session oauth has no access_token', () => {
			const session = createMockSession({
				oauth: { provider: 'test-idp', refresh_token: mockRefreshToken }
			});

			expect(SessionOAuthHelper.getSessionOAuth(session as never)).toBeNull();
		});

		it('returns null when no client is registered for the provider', () => {
			const session = createMockSession({
				oauth: { provider: 'unknown-idp', access_token: mockAccessToken }
			});

			expect(SessionOAuthHelper.getSessionOAuth(session as never)).toBeNull();
		});

		it('returns client and tokens for a valid session', () => {
			const { client } = registerFakeClient('test-idp', { tokenEndpoint: TOKEN_ENDPOINT });
			const session = createMockSession({
				oauth: {
					provider: 'test-idp',
					access_token: mockAccessToken,
					refresh_token: mockRefreshToken,
					id_token: 'id-token-123'
				}
			});

			const result = SessionOAuthHelper.getSessionOAuth(session as never);

			expect(result).toEqual({
				client,
				provider: 'test-idp',
				accessToken: mockAccessToken,
				refreshToken: mockRefreshToken,
				idToken: 'id-token-123'
			});
		});
	});

	describe('updateTokensInSession', () => {
		it('throws when the session has no oauth data to update', async () => {
			const session = createMockSession({ user: { user_id: 'u1' } });

			await expect(
				SessionOAuthHelper.updateTokensInSession(session as never, 'new-access')
			).rejects.toThrow('No OAuth data in session to update.');

			expect(session.save).not.toHaveBeenCalled();
		});

		it('updates the access token and saves the session', async () => {
			const session = createMockSession({
				oauth: {
					provider: 'test-idp',
					access_token: mockAccessToken,
					refresh_token: mockRefreshToken,
					id_token: 'old-id'
				}
			});

			await SessionOAuthHelper.updateTokensInSession(
				session as never,
				'new-access',
				'new-refresh',
				'new-id'
			);

			expect(session.data.oauth).toEqual({
				provider: 'test-idp',
				access_token: 'new-access',
				refresh_token: 'new-refresh',
				id_token: 'new-id'
			});
			expect(session.save).toHaveBeenCalled();
		});

		it('keeps the existing refresh and id tokens when new ones are not provided', async () => {
			const session = createMockSession({
				oauth: {
					provider: 'test-idp',
					access_token: mockAccessToken,
					refresh_token: mockRefreshToken,
					id_token: 'old-id'
				}
			});

			await SessionOAuthHelper.updateTokensInSession(session as never, 'new-access');

			expect(session.data.oauth).toEqual({
				provider: 'test-idp',
				access_token: 'new-access',
				refresh_token: mockRefreshToken,
				id_token: 'old-id'
			});
			expect(session.save).toHaveBeenCalled();
		});
	});

	describe('refreshAccessToken', () => {
		it('refreshes the access token, stores the new tokens and saves', async () => {
			const { refreshAccessToken } = registerFakeClient('test-idp', {
				tokenEndpoint: TOKEN_ENDPOINT,
				refresh: async () => makeTokens('new-access-token', 'new-refresh-token', 'new-id-token')
			});
			const session = createMockSession({
				oauth: {
					provider: 'test-idp',
					access_token: mockAccessToken,
					refresh_token: mockRefreshToken
				}
			});

			await SessionOAuthHelper.refreshAccessToken(session as never);

			expect(refreshAccessToken).toHaveBeenCalledWith(TOKEN_ENDPOINT, mockRefreshToken, ['openid']);
			expect(session.data.oauth).toEqual({
				provider: 'test-idp',
				access_token: 'new-access-token',
				refresh_token: 'new-refresh-token',
				id_token: 'new-id-token'
			});
			expect(session.save).toHaveBeenCalled();
		});

		it('keeps the existing refresh token when the refresh response omits one', async () => {
			registerFakeClient('test-idp', {
				tokenEndpoint: TOKEN_ENDPOINT,
				refresh: async () => makeTokens('new-access-token', null, 'new-id-token')
			});
			const session = createMockSession({
				oauth: {
					provider: 'test-idp',
					access_token: mockAccessToken,
					refresh_token: mockRefreshToken
				}
			});

			await SessionOAuthHelper.refreshAccessToken(session as never);

			expect(session.data.oauth.refresh_token).toBe(mockRefreshToken);
			expect(session.data.oauth.access_token).toBe('new-access-token');
		});

		it('stores the id token as the access token for the google provider', async () => {
			registerFakeClient('google', {
				tokenEndpoint: TOKEN_ENDPOINT,
				refresh: async () => makeTokens('opaque-google-access', 'new-refresh-token', 'google-id-token')
			});
			const session = createMockSession({
				oauth: {
					provider: 'google',
					access_token: mockAccessToken,
					refresh_token: mockRefreshToken
				}
			});

			await SessionOAuthHelper.refreshAccessToken(session as never);

			// Google access tokens are opaque; the id_token is what OBP verifies, so it is
			// stored as the session access token.
			expect(session.data.oauth.access_token).toBe('google-id-token');
			expect(session.data.oauth.id_token).toBe('google-id-token');
			expect(session.save).toHaveBeenCalled();
		});

		it('throws when there is no valid OAuth data in the session', async () => {
			const session = createMockSession({ user: { user_id: 'u1' } });

			await expect(SessionOAuthHelper.refreshAccessToken(session as never)).rejects.toThrow(
				'No valid OAuth data found in session. Please log in again.'
			);
			expect(session.save).not.toHaveBeenCalled();
		});

		it('throws when the client is registered but has no token endpoint', async () => {
			const { refreshAccessToken } = registerFakeClient('test-idp', {
				tokenEndpoint: undefined
			});
			const session = createMockSession({
				oauth: {
					provider: 'test-idp',
					access_token: mockAccessToken,
					refresh_token: mockRefreshToken
				}
			});

			await expect(SessionOAuthHelper.refreshAccessToken(session as never)).rejects.toThrow(
				'No refresh endpoint or refresh token found. Please log in again.'
			);
			expect(refreshAccessToken).not.toHaveBeenCalled();
			expect(session.save).not.toHaveBeenCalled();
		});

		it('throws when the client has no OIDC config at all', async () => {
			registerFakeClient('test-idp', { omitOIDCConfig: true });
			const session = createMockSession({
				oauth: {
					provider: 'test-idp',
					access_token: mockAccessToken,
					refresh_token: mockRefreshToken
				}
			});

			await expect(SessionOAuthHelper.refreshAccessToken(session as never)).rejects.toThrow(
				'No refresh endpoint or refresh token found. Please log in again.'
			);
			expect(session.save).not.toHaveBeenCalled();
		});

		it('throws when the session has no refresh token', async () => {
			registerFakeClient('test-idp', { tokenEndpoint: TOKEN_ENDPOINT });
			const session = createMockSession({
				oauth: {
					provider: 'test-idp',
					access_token: mockAccessToken
				}
			});

			await expect(SessionOAuthHelper.refreshAccessToken(session as never)).rejects.toThrow(
				'No refresh endpoint or refresh token found. Please log in again.'
			);
			expect(session.save).not.toHaveBeenCalled();
		});

		it('throws a generic error when the token refresh request rejects', async () => {
			registerFakeClient('test-idp', {
				tokenEndpoint: TOKEN_ENDPOINT,
				refresh: async () => {
					throw new Error('Token refresh failed at the IdP');
				}
			});
			const session = createMockSession({
				oauth: {
					provider: 'test-idp',
					access_token: mockAccessToken,
					refresh_token: mockRefreshToken
				}
			});

			await expect(SessionOAuthHelper.refreshAccessToken(session as never)).rejects.toThrow(
				'Failed to refresh access token. Please log in again.'
			);
			expect(session.save).not.toHaveBeenCalled();
		});
	});
});
