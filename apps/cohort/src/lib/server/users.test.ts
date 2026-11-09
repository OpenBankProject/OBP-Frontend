import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./obp', () => ({ obpRequests: { get: vi.fn() } }));

const { obpRequests } = await import('./obp');
const { userIdByUsername } = await import('./users');
const get = vi.mocked(obpRequests.get);

describe('userIdByUsername', () => {
	beforeEach(() => get.mockReset());

	it('looks the user up with GET /obp/v7.0.0/users?username=', async () => {
		get.mockResolvedValue({ users: [{ user_id: 'u-1', username: 'ada lovelace', provider: 'local' }] });
		await expect(userIdByUsername('ada lovelace', 'token-1')).resolves.toBe('u-1');
		expect(get).toHaveBeenCalledWith('/obp/v7.0.0/users?username=ada%20lovelace', 'token-1');
	});

	it('only accepts an exact username match', async () => {
		get.mockResolvedValue({ users: [{ user_id: 'u-2', username: 'Ada', provider: 'local' }] });
		await expect(userIdByUsername('ada', 'token-1')).rejects.toThrow(/no user/i);
	});

	it('fails when no user has the username', async () => {
		get.mockResolvedValue({ users: [] });
		await expect(userIdByUsername('nobody', 'token-1')).rejects.toThrow(/no user/i);
	});

	it('fails when users of several providers share the username', async () => {
		get.mockResolvedValue({
			users: [
				{ user_id: 'u-3', username: 'ada', provider: 'local' },
				{ user_id: 'u-4', username: 'ada', provider: 'keycloak' }
			]
		});
		await expect(userIdByUsername('ada', 'token-1')).rejects.toThrow(/2 users/);
	});
});
