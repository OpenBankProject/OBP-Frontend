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
