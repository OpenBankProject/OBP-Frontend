import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { refreshAccessTokenInSession } from '$lib/oauth/session';
import { OAuth2ClientWithConfig } from '$lib/oauth/client';
import {
	mockOIDCConfiguration,
	mockOAuth2Tokens,
	mockAccessToken,
	mockRefreshToken,
	mockEnvironment
} from '../../fixtures/oauth';
import { createMockSession, createMockFetch, mockEnvVars, restoreAllMocks } from '../../helpers';

describe('OAuth Session Utilities', () => {
	let client: OAuth2ClientWithConfig;
	let session: any;
	let originalFetch: typeof global.fetch;

	beforeEach(() => {
		originalFetch = global.fetch;
		mockEnvVars(mockEnvironment);

		client = new OAuth2ClientWithConfig(
			'test-client-id',
			'test-client-secret',
			'http://localhost:3000/callback'
		);

		client.OIDCConfig = mockOIDCConfiguration;

		session = createMockSession({
			user: {
				user_id: 'test-user-123',
				email: 'test@example.com'
			},
			oauth: {
				access_token: mockAccessToken,
				refresh_token: mockRefreshToken
			}
		});
	});

	afterEach(() => {
		global.fetch = originalFetch;
		restoreAllMocks();
	});

	describe('refreshAccessTokenInSession', () => {
		beforeEach(() => {
			// Mock the inherited refreshAccessToken method from Arctic OAuth2Client
			Object.setPrototypeOf(client, {
				...Object.getPrototypeOf(client),
				refreshAccessToken: vi.fn()
			});
		});

		it('should successfully refresh access token', async () => {
			const newAccessToken = 'new-access-token-123';
			const newRefreshToken = 'new-refresh-token-123';

			// Mock the refreshAccessToken method
			const mockRefreshTokens = {
				accessToken: () => newAccessToken,
				refreshToken: () => newRefreshToken,
				accessTokenExpiresAt: () => new Date(Date.now() + 3600000),
				refreshTokenExpiresAt: () => new Date(Date.now() + 86400000),
				scopes: () => ['openid']
			};

			vi.spyOn(client, 'refreshAccessToken').mockResolvedValue(mockRefreshTokens);

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

			expect(session.save).toHaveBeenCalled();
		});

		it('should keep existing refresh token if new one is not provided', async () => {
			const newAccessToken = 'new-access-token-123';

			// Mock the refreshAccessToken method without refresh token
			const mockRefreshTokens = {
				accessToken: () => newAccessToken,
				refreshToken: () => null, // No new refresh token
				accessTokenExpiresAt: () => new Date(Date.now() + 3600000),
				refreshTokenExpiresAt: () => new Date(Date.now() + 86400000),
				scopes: () => ['openid']
			};

			vi.spyOn(client, 'refreshAccessToken').mockResolvedValue(mockRefreshTokens);

			await refreshAccessTokenInSession(session, client);

			expect(session.data.oauth).toEqual({
				access_token: newAccessToken,
				refresh_token: mockRefreshToken // Keep original refresh token
			});

			expect(session.save).toHaveBeenCalled();
		});

		it('should throw error when no refresh endpoint is available', async () => {
			// Remove token endpoint from OIDC config
			client.OIDCConfig = { ...mockOIDCConfiguration };
			delete client.OIDCConfig.token_endpoint;

			await expect(refreshAccessTokenInSession(session, client)).rejects.toThrow(
				'No refresh endpoint or refresh token found. Please log in again.'
			);

			expect(session.save).not.toHaveBeenCalled();
		});

		it('should throw error when no refresh token is available', async () => {
			// Remove refresh token from session
			session.data.oauth = {
				access_token: mockAccessToken
				// No refresh_token
			};

			await expect(refreshAccessTokenInSession(session, client)).rejects.toThrow(
				'No refresh endpoint or refresh token found. Please log in again.'
			);

			expect(session.save).not.toHaveBeenCalled();
		});

		it('should throw error when no oauth data exists in session', async () => {
			// Remove oauth data from session
			session.data = {
				user: {
					user_id: 'test-user-123',
					email: 'test@example.com'
				}
				// No oauth data
			};

			await expect(refreshAccessTokenInSession(session, client)).rejects.toThrow(
				'No refresh endpoint or refresh token found. Please log in again.'
			);

			expect(session.save).not.toHaveBeenCalled();
		});

		it('should throw error when refresh token request fails', async () => {
			const refreshError = new Error('Token refresh failed');
			vi.spyOn(client, 'refreshAccessToken').mockRejectedValue(refreshError);

			await expect(refreshAccessTokenInSession(session, client)).rejects.toThrow(
				'Failed to refresh access token. Please log in again.'
			);

			expect(session.save).not.toHaveBeenCalled();
		});

		it('should log debug information during refresh process', async () => {
			const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const newAccessToken = 'new-access-token-123';
			const mockRefreshTokens = {
				accessToken: () => newAccessToken,
				refreshToken: () => 'new-refresh-token',
				accessTokenExpiresAt: () => new Date(Date.now() + 3600000),
				refreshTokenExpiresAt: () => new Date(Date.now() + 86400000),
				scopes: () => ['openid']
			};

			vi.spyOn(client, 'refreshAccessToken').mockResolvedValue(mockRefreshTokens);

			await refreshAccessTokenInSession(session, client);

			expect(consoleDebugSpy).toHaveBeenCalledWith('Attempting to refresh access token...');
			expect(consoleDebugSpy).toHaveBeenCalledWith('Refreshing access token...');
			expect(consoleErrorSpy).not.toHaveBeenCalled();

			consoleDebugSpy.mockRestore();
			consoleErrorSpy.mockRestore();
		});

		it('should log error when refresh fails', async () => {
			const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			// Remove refresh endpoint
			client.OIDCConfig = { ...mockOIDCConfiguration };
			delete client.OIDCConfig.token_endpoint;

			await expect(refreshAccessTokenInSession(session, client)).rejects.toThrow();

			expect(consoleDebugSpy).toHaveBeenCalledWith('Attempting to refresh access token...');
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'No refresh endpoint or refresh token found. Redirecting to login.'
			);

			consoleDebugSpy.mockRestore();
			consoleErrorSpy.mockRestore();
			consoleWarnSpy.mockRestore();
		});

		it('should log error when token refresh API call fails', async () => {
			const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const refreshError = new Error('API call failed');
			vi.spyOn(client, 'refreshAccessToken').mockRejectedValue(refreshError);

			await expect(refreshAccessTokenInSession(session, client)).rejects.toThrow(
				'Failed to refresh access token. Please log in again.'
			);

			expect(consoleDebugSpy).toHaveBeenCalledWith('Attempting to refresh access token...');
			expect(consoleDebugSpy).toHaveBeenCalledWith('Refreshing access token...');
			expect(consoleErrorSpy).toHaveBeenCalledWith('Error refreshing access token:', refreshError);

			consoleDebugSpy.mockRestore();
			consoleErrorSpy.mockRestore();
		});

		it('should handle session save failure gracefully', async () => {
			const saveError = new Error('Session save failed');
			session.save.mockRejectedValue(saveError);

			const newAccessToken = 'new-access-token-123';
			const mockRefreshTokens = {
				accessToken: () => newAccessToken,
				refreshToken: () => 'new-refresh-token',
				accessTokenExpiresAt: () => new Date(Date.now() + 3600000),
				refreshTokenExpiresAt: () => new Date(Date.now() + 86400000),
				scopes: () => ['openid']
			};

			vi.spyOn(client, 'refreshAccessToken').mockResolvedValue(mockRefreshTokens);

			// The function should still complete the refresh and only fail on save
			await expect(refreshAccessTokenInSession(session, client)).rejects.toThrow(
				'Failed to refresh access token. Please log in again.'
			);

			// Verify that the session data was updated even though save failed
			expect(session.data.oauth.access_token).toBe(newAccessToken);
		});

		it('should work with minimal OIDC configuration', async () => {
			// Use minimal OIDC config with just token endpoint
			client.OIDCConfig = {
				issuer: 'https://test.example.com',
				authorization_endpoint: 'https://test.example.com/auth',
				token_endpoint: 'https://test.example.com/token',
				userinfo_endpoint: 'https://test.example.com/userinfo',
				jwks_uri: 'https://test.example.com/certs',
				response_types_supported: ['code'],
				grant_types_supported: ['authorization_code'],
				subject_types_supported: ['public'],
				id_token_signing_alg_values_supported: ['RS256']
			};

			const newAccessToken = 'new-access-token-123';
			const mockRefreshTokens = {
				accessToken: () => newAccessToken,
				refreshToken: () => 'new-refresh-token',
				accessTokenExpiresAt: () => new Date(Date.now() + 3600000),
				refreshTokenExpiresAt: () => new Date(Date.now() + 86400000),
				scopes: () => ['openid']
			};

			vi.spyOn(client, 'refreshAccessToken').mockResolvedValue(mockRefreshTokens);

			await refreshAccessTokenInSession(session, client);

			expect(client.refreshAccessToken).toHaveBeenCalledWith(
				'https://test.example.com/token',
				mockRefreshToken,
				['openid']
			);

			expect(session.data.oauth.access_token).toBe(newAccessToken);
			expect(session.save).toHaveBeenCalled();
		});
	});

	describe('edge cases', () => {
		it('should handle undefined session data', async () => {
			session.data = undefined;

			await expect(refreshAccessTokenInSession(session, client)).rejects.toThrow(
				'Cannot read properties of undefined'
			);
		});

		it('should handle null session data', async () => {
			session.data = null;

			await expect(refreshAccessTokenInSession(session, client)).rejects.toThrow(
				'Cannot read properties of null'
			);
		});

		it('should handle empty session data', async () => {
			session.data = {};

			await expect(refreshAccessTokenInSession(session, client)).rejects.toThrow(
				'No refresh endpoint or refresh token found. Please log in again.'
			);
		});

		it('should handle session with oauth but no refresh token', async () => {
			session.data = {
				oauth: {
					access_token: mockAccessToken
					// Missing refresh_token
				}
			};

			await expect(refreshAccessTokenInSession(session, client)).rejects.toThrow(
				'No refresh endpoint or refresh token found. Please log in again.'
			);
		});

		it('should handle empty refresh token', async () => {
			session.data.oauth.refresh_token = '';

			await expect(refreshAccessTokenInSession(session, client)).rejects.toThrow(
				'No refresh endpoint or refresh token found. Please log in again.'
			);
		});

		it('should handle client without OIDC config', async () => {
			client.OIDCConfig = undefined;

			await expect(refreshAccessTokenInSession(session, client)).rejects.toThrow(
				'No refresh endpoint or refresh token found. Please log in again.'
			);
		});
	});
});
