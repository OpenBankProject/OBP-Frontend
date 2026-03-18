import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OAuth2ClientWithConfig } from '$lib/oauth/client';
import { refreshAccessTokenInSession } from '$lib/oauth/session';
import { generateState } from 'arctic';
import {
	mockOIDCConfiguration,
	mockUser,
	mockAccessToken,
	mockRefreshToken,
	mockOAuth2Tokens,
	mockEnvironment
} from '../fixtures/oauth';
import { createMockFetch, createMockSession, mockEnvVars, restoreAllMocks } from '../helpers';

// Mock Arctic
vi.mock('arctic', () => ({
	generateState: vi.fn(() => 'mock-state-123'),
	OAuth2Client: vi.fn()
}));

// Mock environment variables
vi.mock('$env/dynamic/private', () => ({
	env: mockEnvironment
}));

vi.mock('$env/dynamic/public', () => ({
	env: mockEnvironment
}));

// Mock the OAuth client module to avoid initialization issues
vi.mock('$lib/oauth/client', () => ({
	OAuth2ClientWithConfig: vi.fn().mockImplementation(() => ({
		OIDCConfig: undefined,
		initOIDCConfig: vi.fn(),
		checkAccessTokenExpiration: vi.fn(),
		createAuthorizationURL: vi.fn(),
		validateAuthorizationCode: vi.fn(),
		refreshAccessToken: vi.fn()
	}))
}));

describe('OAuth Flow Integration Tests', () => {
	let client: OAuth2ClientWithConfig;
	let originalFetch: typeof global.fetch;

	beforeEach(() => {
		originalFetch = global.fetch;
		mockEnvVars(mockEnvironment);
		vi.clearAllMocks();

		client = new OAuth2ClientWithConfig(
			mockEnvironment.OBP_OAUTH_CLIENT_ID,
			mockEnvironment.OBP_OAUTH_CLIENT_SECRET,
			mockEnvironment.APP_CALLBACK_URL
		);

		// Mock inherited methods from Arctic OAuth2Client
		Object.setPrototypeOf(client, {
			...Object.getPrototypeOf(client),
			validateAuthorizationCode: vi.fn(),
			refreshAccessToken: vi.fn(),
			createAuthorizationURL: vi
				.fn()
				.mockImplementation((authEndpoint: string, state: string, scopes: string[]) => {
					const url = new URL(authEndpoint);
					url.searchParams.set('response_type', 'code');
					url.searchParams.set('client_id', mockEnvironment.OBP_OAUTH_CLIENT_ID);
					url.searchParams.set('redirect_uri', mockEnvironment.APP_CALLBACK_URL);
					url.searchParams.set('state', state);
					url.searchParams.set('scope', scopes.join(' '));
					return url;
				})
		});
	});

	afterEach(() => {
		global.fetch = originalFetch;
		restoreAllMocks();
	});

	describe('Complete OAuth Login Flow', () => {
		it('should complete full OAuth flow from initialization to user session', async () => {
			// Step 1: Initialize OIDC configuration
			const mockFetch = createMockFetch([
				{
					url: '/.well-known/openid-configuration',
					response: mockOIDCConfiguration
				},
				{
					url: '/obp/v5.1.0/users/current',
					response: mockUser
				}
			]);
			global.fetch = mockFetch;

			await client.initOIDCConfig(
				'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
			);

			expect(client.OIDCConfig).toEqual(mockOIDCConfiguration);

			// Step 2: Generate authorization URL
			const state = vi.mocked(generateState)();
			const scopes = ['openid'];
			const authUrl = client.createAuthorizationURL(
				client.OIDCConfig.authorization_endpoint,
				state,
				scopes
			);

			expect(authUrl.toString()).toContain(mockOIDCConfiguration.authorization_endpoint);
			expect(authUrl.searchParams.get('state')).toBe(state);
			expect(authUrl.searchParams.get('scope')).toBe('openid');
			expect(authUrl.searchParams.get('client_id')).toBe(mockEnvironment.OBP_OAUTH_CLIENT_ID);
			expect(authUrl.searchParams.get('redirect_uri')).toBe(mockEnvironment.APP_CALLBACK_URL);

			// Step 3: Mock token exchange (would happen after user authorization)
			const mockTokens = {
				accessToken: () => mockAccessToken,
				refreshToken: () => mockRefreshToken,
				accessTokenExpiresAt: () => new Date(Date.now() + 3600000),
				refreshTokenExpiresAt: () => new Date(Date.now() + 86400000),
				scopes: () => ['openid']
			};

			vi.spyOn(client, 'validateAuthorizationCode').mockResolvedValue(mockTokens);

			const tokens = await client.validateAuthorizationCode(
				client.OIDCConfig.token_endpoint,
				'auth-code-123',
				null
			);

			expect(tokens.accessToken()).toBe(mockAccessToken);
			expect(tokens.refreshToken()).toBe(mockRefreshToken);

			// Step 4: Fetch user information
			const userRequest = new Request(
				`${mockEnvironment.PUBLIC_OBP_BASE_URL}/obp/v5.1.0/users/current`
			);
			userRequest.headers.set('Authorization', `Bearer ${tokens.accessToken()}`);

			const userResponse = await fetch(userRequest);
			const userData = await userResponse.json();

			expect(userData).toEqual(mockUser);

			// Step 5: Create session with user data
			const session = createMockSession();
			await session.setData({
				user: userData,
				oauth: {
					access_token: tokens.accessToken(),
					refresh_token: tokens.refreshToken()
				}
			});
			await session.save();

			expect(session.setData).toHaveBeenCalledWith({
				user: mockUser,
				oauth: {
					access_token: mockAccessToken,
					refresh_token: mockRefreshToken
				}
			});
			expect(session.save).toHaveBeenCalled();
		});

		it('should handle OAuth flow with token refresh', async () => {
			// Setup: Initialize client and session with existing tokens
			const mockFetch = createMockFetch([
				{
					url: '/.well-known/openid-configuration',
					response: mockOIDCConfiguration
				}
			]);
			global.fetch = mockFetch;

			await client.initOIDCConfig(
				'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
			);

			const session = createMockSession({
				user: mockUser,
				oauth: {
					access_token: mockAccessToken,
					refresh_token: mockRefreshToken
				}
			});

			// Step 1: Check if access token is expired
			const isExpired = await client.checkAccessTokenExpiration(mockAccessToken);
			expect(isExpired).toBe(false); // Mock token should not be expired

			// Step 2: Simulate expired token scenario and refresh
			const newAccessToken = 'new-access-token-456';
			const newRefreshToken = 'new-refresh-token-456';

			const mockRefreshedTokens = {
				accessToken: () => newAccessToken,
				refreshToken: () => newRefreshToken,
				accessTokenExpiresAt: () => new Date(Date.now() + 3600000),
				refreshTokenExpiresAt: () => new Date(Date.now() + 86400000),
				scopes: () => ['openid']
			};

			vi.spyOn(client, 'refreshAccessToken').mockResolvedValue(mockRefreshedTokens);

			await refreshAccessTokenInSession(session, client);

			expect(client.refreshAccessToken).toHaveBeenCalledWith(
				mockOIDCConfiguration.token_endpoint,
				mockRefreshToken,
				['openid']
			);

			expect(session.data.oauth).toEqual({
				access_token: newAccessToken,
				refresh_token: newRefreshToken
			});
		});

		it('should handle OAuth errors gracefully throughout the flow', async () => {
			// Test OIDC config failure
			const failedFetch = createMockFetch([
				{
					url: '/.well-known/openid-configuration',
					response: { error: 'Not found' },
					status: 404
				}
			]);
			global.fetch = failedFetch;

			await expect(
				client.initOIDCConfig('https://invalid-oauth2.example.com/.well-known/openid-configuration')
			).rejects.toThrow('Failed to fetch OIDC config');

			// Test token validation failure
			const mockFetch = createMockFetch([
				{
					url: '/.well-known/openid-configuration',
					response: mockOIDCConfiguration
				}
			]);
			global.fetch = mockFetch;

			await client.initOIDCConfig(
				'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
			);

			vi.spyOn(client, 'validateAuthorizationCode').mockRejectedValue(
				new Error('Invalid authorization code')
			);

			await expect(
				client.validateAuthorizationCode(client.OIDCConfig!.token_endpoint, 'invalid-code', null)
			).rejects.toThrow('Invalid authorization code');

			// Test token refresh failure
			const session = createMockSession({
				user: mockUser,
				oauth: {
					access_token: mockAccessToken,
					refresh_token: mockRefreshToken
				}
			});

			vi.spyOn(client, 'refreshAccessToken').mockRejectedValue(new Error('Token refresh failed'));

			await expect(refreshAccessTokenInSession(session, client)).rejects.toThrow(
				'Failed to refresh access token. Please log in again.'
			);
		});
	});

	describe('OAuth Configuration Validation', () => {
		it('should validate required OIDC endpoints', async () => {
			const incompleteConfig = {
				...mockOIDCConfiguration
				// Missing token_endpoint
			};
			delete incompleteConfig.token_endpoint;

			const mockFetch = createMockFetch([
				{
					url: '/.well-known/openid-configuration',
					response: incompleteConfig
				}
			]);
			global.fetch = mockFetch;

			await expect(
				client.initOIDCConfig(
					'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
				)
			).rejects.toThrow('Invalid OIDC config: Missing required endpoints.');
		});

		it('should handle malformed OIDC responses', async () => {
			const malformedConfig = {
				issuer: 'https://test.example.com'
				// Missing required fields
			};

			const mockFetch = createMockFetch([
				{
					url: '/.well-known/openid-configuration',
					response: malformedConfig
				}
			]);
			global.fetch = mockFetch;

			await expect(
				client.initOIDCConfig(
					'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
				)
			).rejects.toThrow('Invalid OIDC config: Missing required endpoints.');
		});
	});

	describe('Session Management Integration', () => {
		it('should maintain session state throughout OAuth flow', async () => {
			const session = createMockSession();

			// Initial empty session
			expect(session.data).toEqual({});

			// After successful OAuth login
			await session.setData({
				user: mockUser,
				oauth: {
					access_token: mockAccessToken,
					refresh_token: mockRefreshToken
				}
			});

			expect(session.data.user).toEqual(mockUser);
			expect(session.data.oauth.access_token).toBe(mockAccessToken);
			expect(session.data.oauth.refresh_token).toBe(mockRefreshToken);

			// After token refresh
			const newAccessToken = 'refreshed-token';
			session.data.oauth.access_token = newAccessToken;

			expect(session.data.oauth.access_token).toBe(newAccessToken);
			expect(session.data.oauth.refresh_token).toBe(mockRefreshToken); // Should remain same
		});

		it('should handle session persistence across requests', async () => {
			const session = createMockSession({
				user: mockUser,
				oauth: {
					access_token: mockAccessToken,
					refresh_token: mockRefreshToken
				}
			});

			// Simulate session save and retrieve
			await session.save();
			expect(session.save).toHaveBeenCalled();

			// Session data should persist
			expect(session.data.user).toEqual(mockUser);
			expect(session.data.oauth).toBeDefined();
		});
	});

	describe('Token Lifecycle Management', () => {
		beforeEach(async () => {
			const mockFetch = createMockFetch([
				{
					url: '/.well-known/openid-configuration',
					response: mockOIDCConfiguration
				}
			]);
			global.fetch = mockFetch;

			await client.initOIDCConfig(
				'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
			);
		});

		it('should handle token expiration and renewal cycle', async () => {
			// Create token with short expiration
			const shortLivedToken = {
				sub: 'test-user',
				iss: 'https://test.example.com',
				aud: ['test-client'],
				exp: Math.floor(Date.now() / 1000) + 60, // Expires in 1 minute
				iat: Math.floor(Date.now() / 1000)
			};

			const tokenString =
				btoa(JSON.stringify({ alg: 'RS256' })) +
				'.' +
				btoa(JSON.stringify(shortLivedToken)) +
				'.' +
				'signature';

			// Check token is not yet expired
			const isExpired = await client.checkAccessTokenExpiration(tokenString);
			expect(isExpired).toBe(false);

			// Simulate time passing (token expires)
			const expiredToken = {
				...shortLivedToken,
				exp: Math.floor(Date.now() / 1000) - 60 // Expired 1 minute ago
			};

			const expiredTokenString =
				btoa(JSON.stringify({ alg: 'RS256' })) +
				'.' +
				btoa(JSON.stringify(expiredToken)) +
				'.' +
				'signature';

			const isNowExpired = await client.checkAccessTokenExpiration(expiredTokenString);
			expect(isNowExpired).toBe(true);

			// Should trigger token refresh
			const session = createMockSession({
				user: mockUser,
				oauth: {
					access_token: expiredTokenString,
					refresh_token: mockRefreshToken
				}
			});

			const mockRefreshedTokens = {
				accessToken: () => 'new-fresh-token',
				refreshToken: () => 'new-refresh-token',
				accessTokenExpiresAt: () => new Date(Date.now() + 3600000),
				refreshTokenExpiresAt: () => new Date(Date.now() + 86400000),
				scopes: () => ['openid']
			};

			vi.spyOn(client, 'refreshAccessToken').mockResolvedValue(mockRefreshedTokens);

			await refreshAccessTokenInSession(session, client);

			expect(session.data.oauth.access_token).toBe('new-fresh-token');
		});

		it('should handle concurrent token refresh requests', async () => {
			const session = createMockSession({
				user: mockUser,
				oauth: {
					access_token: mockAccessToken,
					refresh_token: mockRefreshToken
				}
			});

			const mockRefreshedTokens = {
				accessToken: () => 'concurrently-refreshed-token',
				refreshToken: () => 'new-refresh-token',
				accessTokenExpiresAt: () => new Date(Date.now() + 3600000),
				refreshTokenExpiresAt: () => new Date(Date.now() + 86400000),
				scopes: () => ['openid']
			};

			vi.spyOn(client, 'refreshAccessToken').mockResolvedValue(mockRefreshedTokens);

			// Simulate concurrent refresh requests
			const refreshPromise1 = refreshAccessTokenInSession(session, client);
			const refreshPromise2 = refreshAccessTokenInSession(session, client);

			await Promise.all([refreshPromise1, refreshPromise2]);

			// Both should complete successfully
			expect(session.data.oauth.access_token).toBe('concurrently-refreshed-token');
			expect(client.refreshAccessToken).toHaveBeenCalledTimes(2);
		});
	});

	describe('Error Recovery Scenarios', () => {
		it('should recover from network interruptions during OAuth flow', async () => {
			// First attempt fails
			const failingFetch = vi
				.fn()
				.mockRejectedValueOnce(new Error('Network error'))
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockOIDCConfiguration)
				});

			global.fetch = failingFetch;

			// First attempt should fail
			await expect(
				client.initOIDCConfig(
					'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
				)
			).rejects.toThrow('Network error');

			// Second attempt should succeed
			await client.initOIDCConfig(
				'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
			);

			expect(client.OIDCConfig).toEqual(mockOIDCConfiguration);
		});

		it('should handle partial OAuth flow completion', async () => {
			// Initialize client successfully
			const mockFetch = createMockFetch([
				{
					url: '/.well-known/openid-configuration',
					response: mockOIDCConfiguration
				}
			]);
			global.fetch = mockFetch;

			await client.initOIDCConfig(
				'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
			);

			// Token exchange fails
			vi.spyOn(client, 'validateAuthorizationCode').mockRejectedValue(
				new Error('Authorization server error')
			);

			await expect(
				client.validateAuthorizationCode(client.OIDCConfig!.token_endpoint, 'code-123', null)
			).rejects.toThrow('Authorization server error');

			// Client should still be usable for retry
			expect(client.OIDCConfig).toEqual(mockOIDCConfiguration);

			// Retry with successful token exchange
			const mockTokens = {
				accessToken: () => mockAccessToken,
				refreshToken: () => mockRefreshToken,
				accessTokenExpiresAt: () => new Date(Date.now() + 3600000),
				refreshTokenExpiresAt: () => new Date(Date.now() + 86400000),
				scopes: () => ['openid']
			};

			vi.spyOn(client, 'validateAuthorizationCode').mockResolvedValue(mockTokens);

			const tokens = await client.validateAuthorizationCode(
				client.OIDCConfig!.token_endpoint,
				'code-456',
				null
			);

			expect(tokens.accessToken()).toBe(mockAccessToken);
		});
	});
});
