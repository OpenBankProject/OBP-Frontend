import { vi } from 'vitest';
import type { OpenIdConnectConfiguration, OAuth2AccessTokenPayload } from '$lib/oauth/types';
import type { OAuth2Tokens } from 'arctic';

export const mockOIDCConfiguration: OpenIdConnectConfiguration = {
	issuer: 'https://test-oauth2.openbankproject.com/realms/obp-test',
	authorization_endpoint:
		'https://test-oauth2.openbankproject.com/realms/obp-test/protocol/openid-connect/auth',
	token_endpoint:
		'https://test-oauth2.openbankproject.com/realms/obp-test/protocol/openid-connect/token',
	userinfo_endpoint:
		'https://test-oauth2.openbankproject.com/realms/obp-test/protocol/openid-connect/userinfo',
	jwks_uri: 'https://test-oauth2.openbankproject.com/realms/obp-test/protocol/openid-connect/certs',
	revocation_endpoint:
		'https://test-oauth2.openbankproject.com/realms/obp-test/protocol/openid-connect/logout',
	introspection_endpoint:
		'https://test-oauth2.openbankproject.com/realms/obp-test/protocol/openid-connect/token/introspect',
	end_session_endpoint:
		'https://test-oauth2.openbankproject.com/realms/obp-test/protocol/openid-connect/logout',
	scopes_supported: ['openid', 'profile', 'email'],
	response_types_supported: ['code', 'id_token', 'code id_token', 'id_token token'],
	response_modes_supported: ['query', 'fragment', 'form_post'],
	grant_types_supported: [
		'authorization_code',
		'implicit',
		'refresh_token',
		'password',
		'client_credentials'
	],
	subject_types_supported: ['public', 'pairwise'],
	id_token_signing_alg_values_supported: [
		'PS384',
		'ES384',
		'RS384',
		'HS256',
		'HS512',
		'ES256',
		'RS256',
		'HS384',
		'ES512',
		'PS256',
		'PS512',
		'RS512'
	],
	token_endpoint_auth_methods_supported: [
		'private_key_jwt',
		'client_secret_basic',
		'client_secret_post',
		'tls_client_auth',
		'client_secret_jwt'
	],
	claims_supported: [
		'aud',
		'sub',
		'iss',
		'auth_time',
		'name',
		'given_name',
		'family_name',
		'preferred_username',
		'email',
		'acr'
	],
	frontchannel_logout_supported: true,
	frontchannel_logout_session_required: false,
	backchannel_logout_supported: true,
	backchannel_logout_session_required: false
};

export const mockAccessTokenPayload: OAuth2AccessTokenPayload = {
	sub: 'test-user-123',
	iss: 'https://test-oauth2.openbankproject.com/realms/obp-test',
	aud: ['obp-portal', 'account'],
	exp: Math.floor(Date.now() / 1000) + 3600, // expires in 1 hour
	iat: Math.floor(Date.now() / 1000),
	nbf: Math.floor(Date.now() / 1000),
	jti: 'token-id-123',
	scope: 'openid profile email',
	client_id: 'obp-portal',
	preferred_username: 'testuser',
	email: 'test@example.com',
	email_verified: true
};

export const mockExpiredAccessTokenPayload: OAuth2AccessTokenPayload = {
	...mockAccessTokenPayload,
	exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
	iat: Math.floor(Date.now() / 1000) - 7200 // issued 2 hours ago
};

export const mockAccessToken =
	'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJyc2ExIn0.eyJleHAiOjE2MzQ2NzI0MDAsImlhdCI6MTYzNDY3MjEwMCwianRpIjoiYWJjZGVmZ2gtaWprbC1tbm9wLXFyc3QtdXZ3eHl6IiwiaXNzIjoiaHR0cHM6Ly90ZXN0LW9hdXRoMi5vcGVuYmFua3Byb2plY3QuY29tL3JlYWxtcy9vYnAtdGVzdCIsImF1ZCI6WyJvYnAtcG9ydGFsIiwiYWNjb3VudCJdLCJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwidHlwIjoiQmVhcmVyIiwiYXpwIjoib2JwLXBvcnRhbCIsInNlc3Npb25fc3RhdGUiOiIxMjM0NTY3OC05YWJjLWRlZi0xMjM0LTU2Nzg5YWJjZGVmIiwiYWNyIjoiMSIsInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJkZWZhdWx0LXJvbGVzLW9icC10ZXN0Iiwib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwiLCJzaWQiOiIxMjM0NTY3OC05YWJjLWRlZi0xMjM0LTU2Nzg5YWJjZGVmIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInByZWZlcnJlZF91c2VybmFtZSI6InRlc3R1c2VyIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.signature';

export const mockRefreshToken = 'refresh-token-123';

export const mockOAuth2Tokens: OAuth2Tokens = {
	accessToken: () => mockAccessToken,
	refreshToken: () => mockRefreshToken,
	accessTokenExpiresAt: () => new Date(Date.now() + 3600000), // 1 hour from now
	refreshTokenExpiresAt: () => new Date(Date.now() + 86400000), // 24 hours from now
	scopes: () => ['openid', 'profile', 'email']
};

export const mockExpiredOAuth2Tokens: OAuth2Tokens = {
	accessToken: () => 'expired-access-token',
	refreshToken: () => mockRefreshToken,
	accessTokenExpiresAt: () => new Date(Date.now() - 3600000), // expired 1 hour ago
	refreshTokenExpiresAt: () => new Date(Date.now() + 86400000), // 24 hours from now
	scopes: () => ['openid', 'profile', 'email']
};

export const mockUser = {
	user_id: 'test-user-123',
	email: 'test@example.com',
	username: 'testuser',
	first_name: 'Test',
	last_name: 'User',
	provider: 'obp',
	provider_id: 'test-user-123'
};

export const mockSessionData = {
	user: mockUser,
	oauth: {
		access_token: mockAccessToken,
		refresh_token: mockRefreshToken
	}
};

export const mockSession = {
	data: mockSessionData,
	setData: vi.fn(),
	save: vi.fn(),
	destroy: vi.fn()
};

export const mockEmptySession = {
	data: {},
	setData: vi.fn(),
	save: vi.fn(),
	destroy: vi.fn()
};

export const mockRequestEvent = {
	url: new URL('http://localhost:3000/login/obp/callback?code=auth-code-123&state=state-123'),
	cookies: {
		get: vi.fn(),
		set: vi.fn(),
		delete: vi.fn()
	},
	locals: {
		session: mockSession
	},
	request: new Request('http://localhost:3000/login/obp/callback'),
	params: {},
	route: { id: '/login/obp/callback' },
	setHeaders: vi.fn(),
	isDataRequest: false,
	isSubRequest: false
};

export const mockEnvironment = {
	OBP_OAUTH_CLIENT_ID: 'test-client-id',
	OBP_OAUTH_CLIENT_SECRET: 'test-client-secret',
	APP_CALLBACK_URL: 'http://localhost:3000/login/obp/callback',
	PUBLIC_OBP_BASE_URL: 'https://test.openbankproject.com'
};

// Helper functions for creating test data
export const createMockTokens = (overrides: Partial<OAuth2Tokens> = {}): OAuth2Tokens => ({
	...mockOAuth2Tokens,
	...overrides
});

export const createMockSession = (overrides: any = {}) => ({
	...mockSession,
	data: {
		...mockSessionData,
		...overrides
	}
});

export const createMockRequestEvent = (overrides: any = {}) => ({
	...mockRequestEvent,
	...overrides
});

export const createMockUser = (overrides: any = {}) => ({
	...mockUser,
	...overrides
});
