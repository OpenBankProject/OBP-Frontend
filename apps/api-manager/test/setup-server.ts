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

// Mock Arctic OAuth library. Its OAuth2Client is used as a base class; the mock
// returns a plain object, so tests that need the real subclass prototype reset
// this implementation in a beforeEach.
vi.mock('arctic', () => ({
	generateState: vi.fn(() => 'mock-state-123'),
	OAuth2Client: vi.fn().mockImplementation(() => ({
		createAuthorizationURL: vi.fn(),
		validateAuthorizationCode: vi.fn(),
		refreshAccessToken: vi.fn()
	}))
}));

// Global fetch mock (individual tests override as needed)
const mockFetch = vi.fn();
global.fetch = mockFetch;
mockFetch.mockImplementation(async (url: string | Request) => {
	console.warn(`Unmocked fetch call to: ${typeof url === 'string' ? url : url.url}`);
	return new Response(JSON.stringify({ error: 'Not found' }), {
		status: 404,
		headers: { 'content-type': 'application/json' }
	});
});

const originalConsole = { ...console };
afterEach(() => {
	vi.restoreAllMocks();
	Object.assign(console, originalConsole);
});
