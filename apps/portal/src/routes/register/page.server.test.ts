import { describe, it, expect, vi, beforeEach } from 'vitest';
import { actions } from './+page.server.js';
import { OBPRequestError } from '@obp/shared/obp';

// Mock the obp_requests module the action posts through
vi.mock('$lib/obp/requests', () => ({
	obp_requests: {
		post: vi.fn()
	}
}));

import { obp_requests } from '$lib/obp/requests';

describe('Register page actions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const createMockRequest = (formData: Record<string, string>) => {
		const mockFormData = new FormData();
		Object.entries(formData).forEach(([key, value]) => {
			mockFormData.append(key, value);
		});
		return {
			formData: () => Promise.resolve(mockFormData)
		};
	};

	const validForm = {
		email: 'test@example.com',
		username: 'testuser', // 8 chars — passes the length guard
		password: 'password123',
		first_name: 'John',
		last_name: 'Doe'
	};

	const mockCookies = { set: vi.fn() };
	const mockLocals = { session: { data: {} } };

	const run = (form: Record<string, string>) =>
		actions.default({
			request: createMockRequest(form),
			locals: mockLocals,
			cookies: mockCookies
		} as never);

	it('registers a user and redirects to the success page on valid data', async () => {
		const mockResponse = { user_id: 'user-123', username: 'testuser' };
		vi.mocked(obp_requests.post).mockResolvedValue(mockResponse);

		// On success the action throws a SvelteKit redirect to the success page.
		await expect(run(validForm)).rejects.toMatchObject({
			status: 303,
			location: '/register/success'
		});

		expect(obp_requests.post).toHaveBeenCalledWith('/obp/v6.0.0/users', {
			email: 'test@example.com',
			username: 'testuser',
			password: 'password123',
			first_name: 'John',
			last_name: 'Doe'
		});
		// The action stores the response in a short-lived flash cookie.
		expect(mockCookies.set).toHaveBeenCalledWith(
			'user',
			JSON.stringify(mockResponse),
			expect.objectContaining({ path: '/', httpOnly: true })
		);
	});

	it('rejects a username shorter than 8 characters without calling OBP', async () => {
		const result = (await run({ ...validForm, username: 'short' })) as {
			message: string;
			formData: Record<string, string>;
		};

		expect(result.message).toBe('Username must be at least 8 characters long.');
		expect(result.formData.username).toBe('short');
		expect(result.formData).not.toHaveProperty('password');
		expect(obp_requests.post).not.toHaveBeenCalled();
	});

	it('returns the OBP error message when registration is rejected by OBP', async () => {
		vi.mocked(obp_requests.post).mockRejectedValue(
			new OBPRequestError(400, 'OBP-30208: Username already exists.')
		);

		const result = (await run(validForm)) as { message: string; formData: Record<string, string> };

		expect(result.message).toBe('OBP-30208: Username already exists.');
		expect(result.formData.email).toBe('test@example.com');
	});

	it('wraps a generic failure in a descriptive message', async () => {
		vi.mocked(obp_requests.post).mockRejectedValue(new Error('API Error'));

		const result = (await run(validForm)) as { message: string; formData: Record<string, string> };

		expect(result.message).toBe('Failed to register user: API Error');
		expect(obp_requests.post).toHaveBeenCalled();
	});

	it('passes the parsed form fields through to OBP verbatim', async () => {
		vi.mocked(obp_requests.post).mockResolvedValue({ success: true });

		// Success throws the redirect; we only care that the post payload is correct.
		await expect(
			run({
				email: 'user@domain.com',
				username: 'newuser01', // 9 chars
				password: 'securepass',
				first_name: 'Jane',
				last_name: 'Smith'
			})
		).rejects.toMatchObject({ status: 303 });

		const [endpoint, requestBody] = vi.mocked(obp_requests.post).mock.calls[0];
		expect(endpoint).toBe('/obp/v6.0.0/users');
		expect(requestBody).toEqual({
			email: 'user@domain.com',
			username: 'newuser01',
			password: 'securepass',
			first_name: 'Jane',
			last_name: 'Smith'
		});
	});
});
