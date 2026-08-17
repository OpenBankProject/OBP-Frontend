import { describe, it, expect, vi, beforeEach } from 'vitest';
import { actions } from './+page.server.js';

// Mock the obp_requests module the action calls through. Both verbs are stubbed so the
// test can assert which one was used -- that is the whole point of the first case.
vi.mock('$lib/obp/requests', () => ({
	obp_requests: {
		post: vi.fn(),
		put: vi.fn()
	}
}));

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_DEFAULT_BANK_ID: 'gh.29.uk' } }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { obp_requests } from '$lib/obp/requests';

describe('user-invitation accept action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const createMockRequest = (formData: Record<string, string>) => {
		const mockFormData = new FormData();
		Object.entries(formData).forEach(([key, value]) => {
			mockFormData.append(key, value);
		});
		return { formData: () => Promise.resolve(mockFormData) };
	};

	const validForm = {
		secret_key: '12345',
		username: 'inviteduser',
		password: 'password123',
		confirm_password: 'password123',
		first_name: 'Jane',
		last_name: 'Doe',
		email: 'jane@example.com',
		company: 'Example Ltd',
		country: 'DE',
		privacy_policy: 'on',
		terms_conditions: 'on',
		personal_data: 'on',
		bank_id: 'gh.29.uk'
	};

	const run = (form: Record<string, string>) =>
		actions.accept({ request: createMockRequest(form) } as never);

	// The regression this file exists for. OBP-API serves
	// /obp/v4.0.0/banks/{BANK_ID}/user-invitation as POST only -- there is no PUT on that
	// path at any version, so the previous `obp_requests.put` could only ever 404 and
	// accepting an invitation could never complete. Asserting the verb, not just the URL,
	// is what makes this test able to fail if it regresses.
	it('accepts an invitation with POST, not PUT', async () => {
		vi.mocked(obp_requests.post).mockResolvedValue({ user_id: 'user-123' });

		// On success the action throws a SvelteKit redirect to the login page.
		await expect(run(validForm)).rejects.toMatchObject({
			status: 303,
			location: '/login?invitation_accepted=true'
		});

		expect(obp_requests.put).not.toHaveBeenCalled();
		expect(obp_requests.post).toHaveBeenCalledWith(
			'/obp/v4.0.0/banks/gh.29.uk/user-invitation',
			expect.objectContaining({
				secret_key: 12345,
				username: 'inviteduser',
				email: 'jane@example.com'
			})
		);
	});

	it('rejects a password shorter than the minimum without calling the API', async () => {
		const result = await run({ ...validForm, password: 'short', confirm_password: 'short' });

		expect(result).toMatchObject({ success: false });
		expect(obp_requests.post).not.toHaveBeenCalled();
	});

	it('rejects mismatched password confirmation without calling the API', async () => {
		const result = await run({ ...validForm, confirm_password: 'different123' });

		expect(result).toMatchObject({ success: false });
		expect(obp_requests.post).not.toHaveBeenCalled();
	});
});
