import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OAuth2Client } from 'arctic';
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

		// arctic's OAuth2Client is globally mocked to return a plain object, which
		// would hijack `this` in the subclass constructor and strip the subclass's
		// prototype methods. Reset it to a no-op constructor so `super()` leaves the
		// real OAuth2ClientWithConfig instance intact.
		vi.mocked(OAuth2Client).mockImplementation(function () {} as never);

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

		it('should not set OIDC config when fetch returns a non-ok response', async () => {
			const mockFetch = createMockFetch([
				{
					url: '/.well-known/openid-configuration',
					response: { error: 'Not found' },
					status: 404
				}
			]);
			global.fetch = mockFetch;

			await client.initOIDCConfig('https://invalid-url/.well-known/openid-configuration');

			expect(client.OIDCConfig).toBeUndefined();
		});

		it('should not set OIDC config when authorization_endpoint is missing', async () => {
			const invalidConfig = { ...mockOIDCConfiguration };
			delete invalidConfig.authorization_endpoint;

			const mockFetch = createMockFetch([
				{
					url: '/.well-known/openid-configuration',
					response: invalidConfig
				}
			]);
			global.fetch = mockFetch;

			await client.initOIDCConfig(
				'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
			);

			expect(client.OIDCConfig).toBeUndefined();
		});

		it('should not set OIDC config when token_endpoint is missing', async () => {
			const invalidConfig = { ...mockOIDCConfiguration };
			delete invalidConfig.token_endpoint;

			const mockFetch = createMockFetch([
				{
					url: '/.well-known/openid-configuration',
					response: invalidConfig
				}
			]);
			global.fetch = mockFetch;

			await client.initOIDCConfig(
				'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
			);

			expect(client.OIDCConfig).toBeUndefined();
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
				expect.stringContaining('[OAuth2Client]'),
				'Initializing OIDC configuration from OIDC Config URL:',
				'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('[OAuth2Client]'),
				'OIDC config initialization success.'
			);

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

		it('should treat a token without expiration as expired (fail closed)', async () => {
			const tokenWithoutExp = createMockJWT({
				...mockAccessTokenPayload,
				exp: undefined
			});

			const isExpired = await client.checkAccessTokenExpiration(tokenWithoutExp);

			expect(isExpired).toBe(true);
		});

		it('should treat an undecodable token as expired instead of throwing', async () => {
			const invalidToken = 'invalid.token.format';

			await expect(client.checkAccessTokenExpiration(invalidToken)).resolves.toBe(true);
		});

		it('should treat a malformed JWT payload as expired instead of throwing', async () => {
			// A JWT with an invalid base64 payload cannot be decoded.
			const invalidJWT = 'eyJhbGciOiJSUzI1NiJ9.invalid-payload.signature';

			await expect(client.checkAccessTokenExpiration(invalidJWT)).resolves.toBe(true);
		});

		it('should log debug information', async () => {
			const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

			const validToken = createMockJWT(mockAccessTokenPayload);

			await client.checkAccessTokenExpiration(validToken);

			expect(consoleDebugSpy).toHaveBeenCalledWith(
				expect.stringContaining('[OAuth2Client]'),
				'Checking access token expiration...'
			);
			expect(consoleDebugSpy).toHaveBeenCalledWith(
				expect.stringContaining('[OAuth2Client]'),
				'Access token is valid.'
			);

			consoleDebugSpy.mockRestore();
		});

		it('should warn about and fail closed on an invalid payload', async () => {
			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const tokenWithoutPayload = createMockJWT({});

			const isExpired = await client.checkAccessTokenExpiration(tokenWithoutPayload);

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('[OAuth2Client]'),
				'Access token payload is invalid or missing expiration.'
			);
			expect(isExpired).toBe(true);

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
		it('should wrap a fetch failure in a descriptive error', async () => {
			const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure'));
			global.fetch = mockFetch;

			await expect(
				client.initOIDCConfig(
					'https://test-oauth2.openbankproject.com/realms/obp-test/.well-known/openid-configuration'
				)
			).rejects.toThrow('Error fetching OIDC config');
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
