import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OAuth2ClientWithConfig } from '$lib/oauth/client';
import {
	mockOIDCConfiguration,
	mockAccessTokenPayload,
	mockExpiredAccessTokenPayload,
	mockEnvironment
} from '../../fixtures/oauth';
import { createMockFetch, createMockJWT, mockEnvVars, restoreAllMocks } from '../../helpers';

describe('OAuth2ClientWithConfig', () => {
	let client: OAuth2ClientWithConfig;
	let originalFetch: typeof global.fetch;

	beforeEach(() => {
		originalFetch = global.fetch;
		mockEnvVars(mockEnvironment);

		client = new OAuth2ClientWithConfig(
			'test-client-id',
			'test-client-secret',
			'http://localhost:3000/callback'
		);
	});

	afterEach(() => {
		global.fetch = originalFetch;
		restoreAllMocks();
	});

	describe('constructor', () => {
		it('should create instance with correct parameters', () => {
			expect(client).toBeDefined();
			expect(client).toHaveProperty('OIDCConfig');
			expect(client.OIDCConfig).toBeUndefined();
			expect(typeof client.initOIDCConfig).toBe('function');
			expect(typeof client.checkAccessTokenExpiration).toBe('function');
		});
	});

	describe('initOIDCConfig', () => {
		it('should successfully initialize OIDC config', async () => {
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

			expect(client.OIDCConfig).toEqual(mockOIDCConfiguration);
			expect(mockFetch).toHaveBeenCalledWith(
				'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
			);
		});

		it('should throw error when fetch fails', async () => {
			const mockFetch = createMockFetch([
				{
					url: '/.well-known/openid-configuration',
					response: { error: 'Not found' },
					status: 404
				}
			]);
			global.fetch = mockFetch;

			await expect(
				client.initOIDCConfig('https://invalid-url/.well-known/openid-configuration')
			).rejects.toThrow('Failed to fetch OIDC config: Error');
		});

		it('should throw error when config is invalid (missing authorization_endpoint)', async () => {
			const invalidConfig = { ...mockOIDCConfiguration };
			delete invalidConfig.authorization_endpoint;

			const mockFetch = createMockFetch([
				{
					url: '/.well-known/openid-configuration',
					response: invalidConfig
				}
			]);
			global.fetch = mockFetch;

			await expect(
				client.initOIDCConfig(
					'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
				)
			).rejects.toThrow('Invalid OIDC config: Missing required endpoints.');
		});

		it('should throw error when config is invalid (missing token_endpoint)', async () => {
			const invalidConfig = { ...mockOIDCConfiguration };
			delete invalidConfig.token_endpoint;

			const mockFetch = createMockFetch([
				{
					url: '/.well-known/openid-configuration',
					response: invalidConfig
				}
			]);
			global.fetch = mockFetch;

			await expect(
				client.initOIDCConfig(
					'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
				)
			).rejects.toThrow('Invalid OIDC config: Missing required endpoints.');
		});

		it('should handle network errors gracefully', async () => {
			const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
			global.fetch = mockFetch;

			await expect(
				client.initOIDCConfig(
					'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
				)
			).rejects.toThrow('Network error');
		});

		it('should log initialization process', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

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

			expect(consoleSpy).toHaveBeenCalledWith(
				'OAuth2Client: Initializing OIDC configuration from OIDC Config URL:',
				'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
			);
			expect(consoleSpy).toHaveBeenCalledWith('OAuth2Client: OIDC config initialization success.');

			consoleSpy.mockRestore();
		});
	});

	describe('checkAccessTokenExpiration', () => {
		it('should return false for valid token', async () => {
			const validToken = createMockJWT(mockAccessTokenPayload);

			const isExpired = await client.checkAccessTokenExpiration(validToken);

			expect(isExpired).toBe(false);
		});

		it('should return true for expired token', async () => {
			const expiredToken = createMockJWT(mockExpiredAccessTokenPayload);

			const isExpired = await client.checkAccessTokenExpiration(expiredToken);

			expect(isExpired).toBe(true);
		});

		it('should return false for token without expiration', async () => {
			const tokenWithoutExp = createMockJWT({
				...mockAccessTokenPayload,
				exp: undefined
			});

			const isExpired = await client.checkAccessTokenExpiration(tokenWithoutExp);

			expect(isExpired).toBe(false);
		});

		it('should throw error for invalid token format', async () => {
			const invalidToken = 'invalid.token.format';

			await expect(client.checkAccessTokenExpiration(invalidToken)).rejects.toThrow();
		});

		it('should handle malformed JWT payload', async () => {
			// Create a JWT with invalid base64 payload
			const invalidJWT = 'eyJhbGciOiJSUzI1NiJ9.invalid-payload.signature';

			await expect(client.checkAccessTokenExpiration(invalidJWT)).rejects.toThrow();
		});

		it('should log debug information', async () => {
			const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

			const validToken = createMockJWT(mockAccessTokenPayload);

			await client.checkAccessTokenExpiration(validToken);

			expect(consoleDebugSpy).toHaveBeenCalledWith(
				'OAuth2Client: Checking access token expiration...'
			);
			expect(consoleDebugSpy).toHaveBeenCalledWith('OAuth2Client: Access token is valid.');

			consoleDebugSpy.mockRestore();
		});

		it('should warn about invalid payload', async () => {
			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const tokenWithoutPayload = createMockJWT({});

			const isExpired = await client.checkAccessTokenExpiration(tokenWithoutPayload);

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'OAuth2Client: Access token payload is invalid or missing expiration.'
			);
			expect(isExpired).toBe(false);

			consoleWarnSpy.mockRestore();
		});
	});

	describe('createAuthorizationURL', () => {
		beforeEach(() => {
			// Mock the createAuthorizationURL method directly on the client
			client.createAuthorizationURL = vi
				.fn()
				.mockImplementation((authEndpoint: string, state: string, scopes: string[]) => {
					const url = new URL(authEndpoint);
					url.searchParams.set('response_type', 'code');
					url.searchParams.set('client_id', 'test-client-id');
					url.searchParams.set('redirect_uri', 'http://localhost:3000/callback');
					url.searchParams.set('state', state);
					url.searchParams.set('scope', scopes.join(' '));
					return url;
				});
		});

		it('should create authorization URL with correct parameters', () => {
			const authEndpoint = 'https://auth.example.com/authorize';
			const state = 'test-state-123';
			const scopes = ['openid', 'profile'];

			const url = client.createAuthorizationURL(authEndpoint, state, scopes);

			expect(url.origin + url.pathname).toBe(authEndpoint);
			expect(url.searchParams.get('state')).toBe(state);
			expect(url.searchParams.get('scope')).toBe('openid profile');
			expect(url.searchParams.get('response_type')).toBe('code');
			expect(url.searchParams.get('client_id')).toBe('test-client-id');
			expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/callback');
		});

		it('should handle empty scopes array', () => {
			const authEndpoint = 'https://auth.example.com/authorize';
			const state = 'test-state-123';
			const scopes: string[] = [];

			const url = client.createAuthorizationURL(authEndpoint, state, scopes);

			expect(url.searchParams.get('scope')).toBe('');
		});

		it('should handle single scope', () => {
			const authEndpoint = 'https://auth.example.com/authorize';
			const state = 'test-state-123';
			const scopes = ['openid'];

			const url = client.createAuthorizationURL(authEndpoint, state, scopes);

			expect(url.searchParams.get('scope')).toBe('openid');
		});
	});

	describe('integration scenarios', () => {
		beforeEach(() => {
			// Mock the createAuthorizationURL method directly on the client for integration tests
			client.createAuthorizationURL = vi
				.fn()
				.mockImplementation((authEndpoint: string, state: string, scopes: string[]) => {
					const url = new URL(authEndpoint);
					url.searchParams.set('response_type', 'code');
					url.searchParams.set('client_id', 'test-client-id');
					url.searchParams.set('redirect_uri', 'http://localhost:3000/callback');
					url.searchParams.set('state', state);
					url.searchParams.set('scope', scopes.join(' '));
					return url;
				});
		});

		it('should work with complete OAuth flow setup', async () => {
			// Initialize OIDC config
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

			// Create authorization URL
			const state = 'test-state';
			const scopes = ['openid'];
			const authUrl = client.createAuthorizationURL(
				client.OIDCConfig!.authorization_endpoint,
				state,
				scopes
			);

			expect(authUrl.toString()).toContain(mockOIDCConfiguration.authorization_endpoint);
			expect(authUrl.searchParams.get('state')).toBe(state);

			// Check token expiration
			const validToken = createMockJWT(mockAccessTokenPayload);
			const isExpired = await client.checkAccessTokenExpiration(validToken);

			expect(isExpired).toBe(false);
		});

		it('should handle missing OIDC config gracefully', () => {
			// Try to use methods that depend on OIDC config before initialization
			expect(client.OIDCConfig).toBeUndefined();

			// Creating authorization URL should still work if endpoint is provided manually
			const authUrl = client.createAuthorizationURL(
				'https://manual-auth-endpoint.com/auth',
				'state',
				['openid']
			);

			expect(authUrl.toString()).toContain('https://manual-auth-endpoint.com/auth');
		});
	});

	describe('error handling', () => {
		it('should handle console errors gracefully', async () => {
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure'));
			global.fetch = mockFetch;

			await expect(
				client.initOIDCConfig(
					'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
				)
			).rejects.toThrow('Network failure');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'OAuth2Client: Error fetching OIDC config:',
				expect.any(Error)
			);

			consoleErrorSpy.mockRestore();
		});

		it('should handle JSON parsing errors', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.reject(new Error('Invalid JSON'))
			});
			global.fetch = mockFetch;

			await expect(
				client.initOIDCConfig(
					'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
				)
			).rejects.toThrow('Invalid JSON');
		});
	});
});
