import { vi, afterEach } from 'vitest';

// Mock the SvelteKit modules that are commonly used in tests
vi.mock('$app/environment', () => ({
	browser: false,
	building: false,
	dev: true,
	version: 'test'
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
	invalidate: vi.fn(),
	invalidateAll: vi.fn(),
	preloadData: vi.fn(),
	preloadCode: vi.fn(),
	beforeNavigate: vi.fn(),
	afterNavigate: vi.fn(),
	pushState: vi.fn(),
	replaceState: vi.fn()
}));

vi.mock('$app/stores', () => {
	const readable = (value: any) => ({
		subscribe: vi.fn().mockImplementation((fn) => {
			fn(value);
			return () => {};
		})
	});

	return {
		page: readable({
			url: new URL('http://localhost:3000'),
			params: {},
			route: { id: null },
			status: 200,
			error: null,
			data: {},
			form: null
		}),
		navigating: readable(null),
		updated: readable(false)
	};
});

// Mock Arctic OAuth library
vi.mock('arctic', () => ({
	generateState: vi.fn(() => 'mock-state-123'),
	OAuth2Client: vi.fn().mockImplementation(() => ({
		createAuthorizationURL: vi.fn(),
		validateAuthorizationCode: vi.fn(),
		refreshAccessToken: vi.fn()
	}))
}));

// Global fetch mock setup
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Default fetch mock implementation
mockFetch.mockImplementation(async (url: string | Request) => {
	console.warn(`Unmocked fetch call to: ${typeof url === 'string' ? url : url.url}`);
	return {
		ok: false,
		status: 404,
		statusText: 'Not Found',
		json: () => Promise.resolve({ error: 'Not found' }),
		text: () => Promise.resolve('Not found'),
		headers: new Headers()
	};
});

// Mock crypto for Node.js environment
Object.defineProperty(global, 'crypto', {
	value: {
		randomUUID: () => 'mock-uuid-123',
		getRandomValues: (arr: any) => {
			for (let i = 0; i < arr.length; i++) {
				arr[i] = Math.floor(Math.random() * 256);
			}
			return arr;
		}
	}
});

// Console setup for tests
const originalConsole = { ...console };

// Restore console methods after each test
afterEach(() => {
	vi.restoreAllMocks();
	Object.assign(console, originalConsole);
});

// Global test utilities
declare global {
	var __TEST_ENV__: boolean;
}

globalThis.__TEST_ENV__ = true;

// Export test utilities for use in test files
export const testUtils = {
	mockFetch,
	originalConsole,
	createMockResponse: (data: any, status = 200) => ({
		ok: status < 400,
		status,
		statusText: status === 200 ? 'OK' : 'Error',
		json: () => Promise.resolve(data),
		text: () => Promise.resolve(JSON.stringify(data)),
		headers: new Headers()
	})
};
