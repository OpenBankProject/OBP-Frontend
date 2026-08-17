import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';

// The component pulls in $lib/avatar/generate, which reads $env/dynamic/public at module
// scope. Unmocked, that is undefined under vitest and the import throws before any test
// runs.
vi.mock('$env/dynamic/public', () => ({ env: {} }));

import ChatRoomPage from '$lib/../routes/(protected)/user/chat/[chatRoomId]/+page.svelte';

// The component opens an EventSource and a poll interval on mount; jsdom has neither.
class FakeEventSource {
	onmessage: ((e: MessageEvent) => void) | null = null;
	onerror: ((e: Event) => void) | null = null;
	close() {}
	addEventListener() {}
}

const CURRENT_USER = 'user-me';
const MESSAGE_ID = 'msg-1';

function makeData() {
	return {
		chatRoom: { chat_room_id: 'room-1', name: 'Test room' },
		currentUserId: CURRENT_USER,
		participants: [{ user_id: CURRENT_USER, username: 'me' }],
		messages: [
			{
				chat_message_id: MESSAGE_ID,
				message: 'hello',
				from_user_id: CURRENT_USER,
				created_at: '2026-01-01T00:00:00Z',
				// A reaction this user already left, so the badge click removes it.
				reactions: [{ emoji: '👍', user_ids: [CURRENT_USER] }]
			}
		]
	} as never;
}

describe('chat reactions', () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		document.body.innerHTML = '';
		vi.stubGlobal('EventSource', FakeEventSource);
		fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		document.body.innerHTML = '';
	});

	const clickBadge = async () => {
		const badge = await screen.findByTestId(`reaction-badge-${MESSAGE_ID}-👍`);
		badge.click();
		// let the click handler's await settle
		await new Promise((r) => setTimeout(r, 0));
	};

	const reactionCalls = () =>
		fetchMock.mock.calls.filter(([url]) => String(url).includes('/reactions'));

	// The regression this file exists for. OBP-API serves the emoji as the last PATH
	// segment on DELETE -- `.../reactions/{emoji}` -- and only POST/GET on
	// `.../reactions`. Sending it in the body meant the request 404'd every time.
	it('removes a reaction with the emoji in the path, not the body', async () => {
		render(ChatRoomPage, { data: makeData() });
		await clickBadge();

		const calls = reactionCalls();
		expect(calls.length).toBe(1);

		const [url, init] = calls[0];
		expect(init.method).toBe('DELETE');
		expect(String(url)).toBe(
			`/proxy/obp/v6.0.0/chat-rooms/room-1/messages/${MESSAGE_ID}/reactions/${encodeURIComponent('👍')}`
		);
		// A body on this DELETE is what the endpoint does not read.
		expect(init.body).toBeUndefined();
	});

	// fetch resolves on a 4xx rather than rejecting, so a try/catch alone cannot see the
	// failure. Before res.ok was checked, a rejected removal left the reaction gone from
	// the UI, still in the database, and back again on reload -- with nothing logged.
	it('restores the reaction in the UI when the request fails', async () => {
		fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
		render(ChatRoomPage, { data: makeData() });

		await clickBadge();
		await new Promise((r) => setTimeout(r, 0));

		expect(screen.queryByTestId(`reaction-badge-${MESSAGE_ID}-👍`)).not.toBeNull();
	});

	// The add path was already correct and must stay that way: POST to `.../reactions`
	// with the emoji in the body is exactly what OBP-API serves.
	it('adds a reaction with the emoji in the body, unchanged', async () => {
		const data = makeData();
		// Nobody has reacted yet, so the same badge click adds rather than removes.
		(data as never as { messages: Array<{ reactions: unknown[] }> }).messages[0].reactions = [
			{ emoji: '👍', user_ids: ['someone-else'] }
		];
		render(ChatRoomPage, { data });
		await clickBadge();

		const [url, init] = reactionCalls()[0];
		expect(init.method).toBe('POST');
		expect(String(url)).toBe(
			`/proxy/obp/v6.0.0/chat-rooms/room-1/messages/${MESSAGE_ID}/reactions`
		);
		expect(JSON.parse(init.body)).toEqual({ emoji: '👍' });
	});
});
