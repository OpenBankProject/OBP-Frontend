import { vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Creates a mock fetch function that can be used to mock API responses
 */
export const createMockFetch = (responses: Array<{ url?: string; response: any; status?: number }>) => {
	return vi.fn().mockImplementation(async (url: string | Request, options?: RequestInit) => {
		const urlString = typeof url === 'string' ? url : url.url;

		const matchedResponse = responses.find(r =>
			!r.url || urlString.includes(r.url)
		);

		if (!matchedResponse) {
			throw new Error(`No mock response found for URL: ${urlString}`);
		}

		return {
			ok: (matchedResponse.status || 200) < 400,
			status: matchedResponse.status || 200,
			statusText: matchedResponse.status === 200 ? 'OK' : 'Error',
			json: () => Promise.resolve(matchedResponse.response),
			text: () => Promise.resolve(JSON.stringify(matchedResponse.response)),
			headers: new Headers()
		};
	});
};

/**
 * Creates a mock FormData object from a plain object
 */
export const createMockFormData = (data: Record<string, string>): FormData => {
	const formData = new FormData();
	Object.entries(data).forEach(([key, value]) => {
		formData.append(key, value);
	});
	return formData;
};

/**
 * Creates a mock Request object with form data
 */
export const createMockRequest = (formData: Record<string, string>): { formData: () => Promise<FormData> } => ({
	formData: () => Promise.resolve(createMockFormData(formData))
});

/**
 * Creates a mock cookies object
 */
export const createMockCookies = () => ({
	get: vi.fn(),
	set: vi.fn(),
	delete: vi.fn(),
	getAll: vi.fn(),
	serialize: vi.fn()
});

/**
 * Creates a mock URL with search parameters
 */
export const createMockURL = (baseUrl: string, searchParams: Record<string, string> = {}): URL => {
	const url = new URL(baseUrl);
	Object.entries(searchParams).forEach(([key, value]) => {
		url.searchParams.set(key, value);
	});
	return url;
};

/**
 * Creates a mock session object
 */
export const createMockSession = (data: any = {}) => ({
	data,
	setData: vi.fn().mockImplementation((newData) => {
		Object.assign(data, newData);
	}),
	save: vi.fn(),
	destroy: vi.fn(),
	update: vi.fn()
});

/**
 * Creates a mock RequestEvent object
 */
export const createMockRequestEvent = (overrides: Partial<RequestEvent> = {}): RequestEvent => {
	const mockCookies = createMockCookies();
	const mockSession = createMockSession();

	return {
		url: new URL('http://localhost:3000'),
		request: new Request('http://localhost:3000'),
		params: {},
		route: { id: '/' },
		cookies: mockCookies,
		locals: { session: mockSession },
		fetch: global.fetch,
		getClientAddress: () => '127.0.0.1',
		platform: undefined,
		isDataRequest: false,
		isSubRequest: false,
		setHeaders: vi.fn(),
		...overrides
	} as RequestEvent;
};

/**
 * Helper to wait for promises to resolve in tests
 */
export const waitFor = (ms: number = 0): Promise<void> =>
	new Promise(resolve => setTimeout(resolve, ms));

/**
 * Helper to create a mock JWT token with custom payload
 */
export const createMockJWT = (payload: Record<string, any>): string => {
	const header = { alg: 'RS256', typ: 'JWT' };
	const encodedHeader = btoa(JSON.stringify(header));
	const encodedPayload = btoa(JSON.stringify(payload));
	const signature = 'mock-signature';

	return `${encodedHeader}.${encodedPayload}.${signature}`;
};

/**
 * Helper to mock environment variables
 */
export const mockEnvVars = (vars: Record<string, string>) => {
	Object.entries(vars).forEach(([key, value]) => {
		vi.stubEnv(key, value);
	});
};

/**
 * Helper to restore all mocks
 */
export const restoreAllMocks = () => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
};

/**
 * Creates a mock OAuth2 response
 */
export const createMockOAuth2Response = (tokens: { accessToken: string; refreshToken?: string }) => ({
	access_token: tokens.accessToken,
	refresh_token: tokens.refreshToken,
	token_type: 'Bearer',
	expires_in: 3600,
	scope: 'openid profile email'
});

/**
 * Creates a mock OIDC configuration response
 */
export const createMockOIDCConfig = (overrides: Record<string, any> = {}) => ({
	issuer: 'https://test-oauth2.openbankproject.com/realms/obp-test',
	authorization_endpoint: 'https://test-oauth2.openbankproject.com/realms/obp-test/protocol/openid-connect/auth',
	token_endpoint: 'https://test-oauth2.openbankproject.com/realms/obp-test/protocol/openid-connect/token',
	userinfo_endpoint: 'https://test-oauth2.openbankproject.com/realms/obp-test/protocol/openid-connect/userinfo',
	jwks_uri: 'https://test-oauth2.openbankproject.com/realms/obp-test/protocol/openid-connect/certs',
	scopes_supported: ['openid', 'profile', 'email'],
	response_types_supported: ['code'],
	grant_types_supported: ['authorization_code', 'refresh_token'],
	subject_types_supported: ['public'],
	id_token_signing_alg_values_supported: ['RS256'],
	...overrides
});

/**
 * Asserts that a function throws an error with a specific message
 */
export const expectToThrow = async (fn: () => Promise<any> | any, expectedMessage?: string) => {
	try {
		await fn();
		throw new Error('Expected function to throw, but it did not');
	} catch (error) {
		if (expectedMessage && !error.message.includes(expectedMessage)) {
			throw new Error(`Expected error message to contain "${expectedMessage}", but got "${error.message}"`);
		}
		return error;
	}
};
