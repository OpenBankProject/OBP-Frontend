import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '$lib/../routes/login/obp/+server';
import { GET as CallbackGET } from '$lib/../routes/login/obp/callback/+server';
import { generateState } from 'arctic';
import {
	mockOIDCConfiguration,
	mockUser,
	mockAccessToken,
	mockRefreshToken,
	mockEnvironment
} from '../../fixtures/oauth';
import { createMockRequestEvent, createMockFetch, mockEnvVars, restoreAllMocks } from '../../helpers';

// Mock the oauth client module
vi.mock('$lib/oauth/client', () => ({
	obp_oauth: {
		OIDCConfig: mockOIDCConfiguration,
		createAuthorizationURL: vi.fn()
	}
}));

// Mock the generateState function
vi.mock('arctic', () => ({
	generateState: vi.fn()
}));

// Mock environment variables
vi.mock('$env/dynamic/public', () => ({
	env: mockEnvironment
}));

import { obp_oauth } from '$lib/oauth/client';

describe('Login Server Routes', () => {
	let originalFetch: typeof global.fetch;

	beforeEach(() => {
		originalFetch = global.fetch;
		mockEnvVars(mockEnvironment);
		vi.clearAllMocks();
	});

	afterEach(() => {
		global.fetch = originalFetch;
		restoreAllMocks();
	});

	describe('/login/obp/+server.ts - GET', () => {
		it('should redirect to OAuth authorization URL', () => {
			const mockState = 'test-state-123';
			const mockAuthURL = new URL('https://auth.example.com/authorize?state=test-state-123&client_id=test-client');

			vi.mocked(generateState).mockReturnValue(mockState);
			vi.mocked(obp_oauth.createAuthorizationURL).mockReturnValue(mockAuthURL);

			const event = createMockRequestEvent();

			const response = GET(event);

			expect(generateState).toHaveBeenCalled();
			expect(obp_oauth.createAuthorizationURL).toHaveBeenCalledWith(
				mockOIDCConfiguration.authorization_endpoint,
				mockState,
				['openid']
			);

			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toBe(mockAuthURL.toString());

			expect(event.cookies.set).toHaveBeenCalledWith('obp_oauth_state', mockState, {
				httpOnly: true,
				maxAge: 600, // 10 minutes
				secure: false, // import.meta.env.PROD would be false in tests
				path: '/',
				sameSite: 'lax'
			});
		});

		it('should handle missing authorization endpoint', () => {
			const mockState = 'test-state-123';
			vi.mocked(generateState).mockReturnValue(mockState);

			// Mock oauth client with missing authorization endpoint
			vi.mocked(obp_oauth).OIDCConfig = {
				...mockOIDCConfiguration,
				authorization_endpoint: undefined as any
			};

			const event = createMockRequestEvent();

			const response = GET(event);

			expect(response.status).toBe(500);
			expect(response.statusText).toBe('Internal Server Error');
		});

		it('should handle oauth client errors', () => {
			const mockState = 'test-state-123';
			vi.mocked(generateState).mockReturnValue(mockState);
			vi.mocked(obp_oauth.createAuthorizationURL).mockImplementation(() => {
				throw new Error('OAuth configuration error');
			});

			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const event = createMockRequestEvent();

			const response = GET(event);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'Error during OBP OAuth login:',
				expect.any(Error)
			);
			expect(response.status).toBe(500);

			consoleErrorSpy.mockRestore();
		});

		it('should set secure cookie in production', () => {
			const mockState = 'test-state-123';
			const mockAuthURL = new URL('https://auth.example.com/authorize');

			vi.mocked(generateState).mockReturnValue(mockState);
			vi.mocked(obp_oauth.createAuthorizationURL).mockReturnValue(mockAuthURL);

			// Mock production environment
			const originalEnv = import.meta.env;
			Object.defineProperty(import.meta, 'env', {
				value: { ...originalEnv, PROD: true },
				writable: true
			});

			const event = createMockRequestEvent();

			const response = GET(event);

			expect(event.cookies.set).toHaveBeenCalledWith('obp_oauth_state', mockState, {
				httpOnly: true,
				maxAge: 600,
				secure: true, // Should be true in production
				path: '/',
				sameSite: 'lax'
			});

			// Restore original env
			Object.defineProperty(import.meta, 'env', {
				value: originalEnv,
				writable: true
			});
		});
	});

	describe('/login/obp/callback/+server.ts - GET', () => {
		beforeEach(() => {
			// Reset oauth client mock
			vi.mocked(obp_oauth).OIDCConfig = mockOIDCConfiguration;
			vi.mocked(obp_oauth).validateAuthorizationCode = vi.fn();
		});

		it('should successfully handle OAuth callback and redirect to home', async () => {
			const mockCode = 'auth-code-123';
			const mockState = 'state-123';
			const mockTokens = {
				accessToken: () => mockAccessToken,
				refreshToken: () => mockRefreshToken
			};

			// Mock successful token exchange
			vi.mocked(obp_oauth.validateAuthorizationCode).mockResolvedValue(mockTokens);

			// Mock successful user fetch
			const mockFetch = createMockFetch([
				{
					url: '/obp/v5.1.0/users/current',
					response: mockUser
				}
			]);
			global.fetch = mockFetch;

			const event = createMockRequestEvent({
				url: new URL(`http://localhost:3000/login/obp/callback?code=${mockCode}&state=${mockState}`),
				cookies: {
					get: vi.fn().mockReturnValue(mockState),
					set: vi.fn(),
					delete: vi.fn()
				}
			});

			const response = await CallbackGET(event);

			expect(obp_oauth.validateAuthorizationCode).toHaveBeenCalledWith(
				mockOIDCConfiguration.token_endpoint,
				mockCode,
				null
			);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.objectContaining({
					url: `${mockEnvironment.PUBLIC_OBP_BASE_URL}/obp/v5.1.0/users/current`
				})
			);

			expect(event.locals.session.setData).toHaveBeenCalledWith({
				user: mockUser,
				oauth: {
					access_token: mockAccessToken,
					refresh_token: mockRefreshToken
				}
			});

			expect(event.locals.session.save).toHaveBeenCalled();
			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toBe('/');
		});

		it('should handle OAuth error response with invalid_grant', async () => {
			const mockState = 'state-123:obp-oidc';
			const event = createMockRequestEvent({
				url: new URL('http://localhost:3000/login/obp/callback?error=invalid_grant&error_description=Invalid+username+or+password&state=' + mockState),
				cookies: {
					get: vi.fn().mockReturnValue(mockState),
					set: vi.fn(),
					delete: vi.fn()
				}
			});

			const response = await CallbackGET(event);

			expect(event.cookies.delete).toHaveBeenCalledWith('obp_oauth_state', { path: '/' });
			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toContain('/login?error=');
			expect(decodeURIComponent(response.headers.get('Location') || '')).toContain('Invalid username or password');
		});

		it('should handle OAuth error response with access_denied', async () => {
			const mockState = 'state-123:obp-oidc';
			const event = createMockRequestEvent({
				url: new URL('http://localhost:3000/login/obp/callback?error=access_denied&error_description=User+denied+access&state=' + mockState),
				cookies: {
					get: vi.fn().mockReturnValue(mockState),
					set: vi.fn(),
					delete: vi.fn()
				}
			});

			const response = await CallbackGET(event);

			expect(event.cookies.delete).toHaveBeenCalledWith('obp_oauth_state', { path: '/' });
			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toContain('/login?error=');
			expect(decodeURIComponent(response.headers.get('Location') || '')).toContain('Access was denied');
		});

		it('should handle OAuth error response with custom error_description', async () => {
			const mockState = 'state-123:obp-oidc';
			const event = createMockRequestEvent({
				url: new URL('http://localhost:3000/login/obp/callback?error=server_error&error_description=Something+went+wrong&state=' + mockState),
				cookies: {
					get: vi.fn().mockReturnValue(mockState),
					set: vi.fn(),
					delete: vi.fn()
				}
			});

			const response = await CallbackGET(event);

			expect(event.cookies.delete).toHaveBeenCalledWith('obp_oauth_state', { path: '/' });
			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toContain('/login?error=');
			expect(decodeURIComponent(response.headers.get('Location') || '')).toContain('Something went wrong');
		});

		it('should return 400 when required parameters are missing', async () => {
			const event = createMockRequestEvent({
				url: new URL('http://localhost:3000/login/obp/callback'), // No code or state
				cookies: {
					get: vi.fn().mockReturnValue('stored-state'),
					set: vi.fn(),
					delete: vi.fn()
				}
			});

			const response = await CallbackGET(event);

			expect(response.status).toBe(400);
			expect(await response.text()).toBe('Please restart the process.');
		});

		it('should return 400 when stored state is missing', async () => {
			const event = createMockRequestEvent({
				url: new URL('http://localhost:3000/login/obp/callback?code=test-code&state=test-state'),
				cookies: {
					get: vi.fn().mockReturnValue(null), // No stored state
					set: vi.fn(),
					delete: vi.fn()
				}
			});

			const response = await CallbackGET(event);

			expect(response.status).toBe(400);
			expect(await response.text()).toBe('Please restart the process.');
		});

		it('should return 400 when state does not match', async () => {
			const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

			const event = createMockRequestEvent({
				url: new URL('http://localhost:3000/login/obp/callback?code=test-code&state=different-state'),
				cookies: {
					get: vi.fn().mockReturnValue('stored-state'), // Different state
					set: vi.fn(),
					delete: vi.fn()
				}
			});

			const response = await CallbackGET(event);

			expect(consoleLogSpy).toHaveBeenCalledWith('State mismatch:', 'stored-state', 'different-state');
			expect(response.status).toBe(400);
			expect(await response.text()).toBe('Please restart the process.');

			consoleLogSpy.mockRestore();
		});

		it('should handle token validation failure', async () => {
			const mockCode = 'auth-code-123';
			const mockState = 'state-123';

			vi.mocked(obp_oauth.validateAuthorizationCode).mockRejectedValue(
				new Error('Invalid authorization code')
			);

			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const event = createMockRequestEvent({
				url: new URL(`http://localhost:3000/login/obp/callback?code=${mockCode}&state=${mockState}`),
				cookies: {
					get: vi.fn().mockReturnValue(mockState),
					set: vi.fn(),
					delete: vi.fn()
				}
			});

			const response = await CallbackGET(event);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'Error validating authorization code:',
				expect.any(Error)
			);
			expect(response.status).toBe(400);
			expect(await response.text()).toBe('Log in failed, please restart the process.');

			consoleErrorSpy.mockRestore();
		});

		it('should handle missing token endpoint', async () => {
			const mockCode = 'auth-code-123';
			const mockState = 'state-123';

			// Mock oauth client with missing token endpoint
			vi.mocked(obp_oauth).OIDCConfig = {
				...mockOIDCConfiguration,
				token_endpoint: undefined as any
			};

			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const event = createMockRequestEvent({
				url: new URL(`http://localhost:3000/login/obp/callback?code=${mockCode}&state=${mockState}`),
				cookies: {
					get: vi.fn().mockReturnValue(mockState),
					set: vi.fn(),
					delete: vi.fn()
				}
			});

			const response = await CallbackGET(event);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'Error validating authorization code:',
				expect.any(Error)
			);
			expect(response.status).toBe(400);

			consoleErrorSpy.mockRestore();
		});

		it('should handle user fetch failure', async () => {
			const mockCode = 'auth-code-123';
			const mockState = 'state-123';
			const mockTokens = {
				accessToken: () => mockAccessToken,
				refreshToken: () => mockRefreshToken
			};

			vi.mocked(obp_oauth.validateAuthorizationCode).mockResolvedValue(mockTokens);

			// Mock failed user fetch
			const mockFetch = createMockFetch([
				{
					url: '/obp/v5.1.0/users/current',
					response: { error: 'Unauthorized' },
					status: 401
				}
			]);
			global.fetch = mockFetch;

			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const event = createMockRequestEvent({
				url: new URL(`http://localhost:3000/login/obp/callback?code=${mockCode}&state=${mockState}`),
				cookies: {
					get: vi.fn().mockReturnValue(mockState),
					set: vi.fn(),
					delete: vi.fn()
				}
			});

			const response = await CallbackGET(event);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'Failed to fetch current user:',
				expect.any(String)
			);
			expect(response.status).toBe(500);
			expect(await response.text()).toBe('Failed to fetch current user');

			consoleErrorSpy.mockRestore();
		});

		it('should handle user without required fields', async () => {
			const mockCode = 'auth-code-123';
			const mockState = 'state-123';
			const mockTokens = {
				accessToken: () => mockAccessToken,
				refreshToken: () => mockRefreshToken
			};

			vi.mocked(obp_oauth.validateAuthorizationCode).mockResolvedValue(mockTokens);

			// Mock user response without required fields
			const incompleteUser = {
				user_id: 'test-user-123'
				// Missing email
			};

			const mockFetch = createMockFetch([
				{
					url: '/obp/v5.1.0/users/current',
					response: incompleteUser
				}
			]);
			global.fetch = mockFetch;

			const event = createMockRequestEvent({
				url: new URL(`http://localhost:3000/login/obp/callback?code=${mockCode}&state=${mockState}`),
				cookies: {
					get: vi.fn().mockReturnValue(mockState),
					set: vi.fn(),
					delete: vi.fn()
				}
			});

			const response = await CallbackGET(event);

			// Should not redirect since user doesn't have required fields
			expect(response).toBeUndefined();
			expect(event.locals.session.setData).not.toHaveBeenCalled();
		});

		it('should log user data and session information', async () => {
			const mockCode = 'auth-code-123';
			const mockState = 'state-123';
			const mockTokens = {
				accessToken: () => mockAccessToken,
				refreshToken: () => mockRefreshToken
			};

			vi.mocked(obp_oauth.validateAuthorizationCode).mockResolvedValue(mockTokens);

			const mockFetch = createMockFetch([
				{
					url: '/obp/v5.1.0/users/current',
					response: mockUser
				}
			]);
			global.fetch = mockFetch;

			const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

			const event = createMockRequestEvent({
				url: new URL(`http://localhost:3000/login/obp/callback?code=${mockCode}&state=${mockState}`),
				cookies: {
					get: vi.fn().mockReturnValue(mockState),
					set: vi.fn(),
					delete: vi.fn()
				}
			});

			await CallbackGET(event);

			expect(consoleLogSpy).toHaveBeenCalledWith('Current user data:', mockUser);
			expect(consoleLogSpy).toHaveBeenCalledWith('Session data set:', expect.any(Object));

			consoleLogSpy.mockRestore();
		});

		it('should handle session save failure gracefully', async () => {
			const mockCode = 'auth-code-123';
			const mockState = 'state-123';
			const mockTokens = {
				accessToken: () => mockAccessToken,
				refreshToken: () => mockRefreshToken
			};

			vi.mocked(obp_oauth.validateAuthorizationCode).mockResolvedValue(mockTokens);

			const mockFetch = createMockFetch([
				{
					url: '/obp/v5.1.0/users/current',
					response: mockUser
				}
			]);
			global.fetch = mockFetch;

			// Mock session save failure
			const event = createMockRequestEvent({
				url: new URL(`http://localhost:3000/login/obp/callback?code=${mockCode}&state=${mockState}`),
				cookies: {
					get: vi.fn().mockReturnValue(mockState),
					set: vi.fn(),
					delete: vi.fn()
				}
			});

			event.locals.session.save.mockRejectedValue(new Error('Session save failed'));

			// Should throw error when session save fails
			await expect(CallbackGET(event)).rejects.toThrow('Session save failed');

			expect(event.locals.session.setData).toHaveBeenCalled();
		});
	});

	describe('edge cases', () => {
		it('should handle malformed URLs in callback', async () => {
			const event = createMockRequestEvent({
				url: new URL('http://localhost:3000/login/obp/callback?code=test%20code&state=test%20state'),
				cookies: {
					get: vi.fn().mockReturnValue('test state'),
					set: vi.fn(),
					delete: vi.fn()
				}
			});

			const response = await CallbackGET(event);

			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toBe('/');
		});

		it('should handle missing OIDC configuration', () => {
			vi.mocked(obp_oauth).OIDCConfig = undefined;

			const event = createMockRequestEvent();

			const response = GET(event);

			expect(response.status).toBe(500);
		});

		it('should handle empty user response', async () => {
			const mockCode = 'auth-code-123';
			const mockState = 'state-123';
			const mockTokens = {
				accessToken: () => mockAccessToken,
				refreshToken: () => mockRefreshToken
			};

			vi.mocked(obp_oauth.validateAuthorizationCode).mockResolvedValue(mockTokens);

			const mockFetch = createMockFetch([
				{
					url: '/obp/v5.1.0/users/current',
					response: {}
				}
			]);
			global.fetch = mockFetch;

			const event = createMockRequestEvent({
				url: new URL(`http://localhost:3000/login/obp/callback?code=${mockCode}&state=${mockState}`),
				cookies: {
					get: vi.fn().mockReturnValue(mockState),
					set: vi.fn(),
					delete: vi.fn()
				}
			});

			const response = await CallbackGET(event);

			expect(response).toBeUndefined();
		});
	});
});
