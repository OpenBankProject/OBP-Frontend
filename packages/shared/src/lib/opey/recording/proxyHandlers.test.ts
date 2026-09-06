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
/**
 * Lives outside src/lib/server so vitest picks it up; exercises the server-side proxy
 * factory with a fake Opey and a fake OBP.
 */
import { describe, it, expect, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { createOpeyProxyHandlers, pickCookie } from '../../server/opey/proxyHandlers';

const sse = (event: Record<string, unknown>) => `data: ${JSON.stringify(event)}\n\n`;

function opeyStream(chunks: string[], headers: Record<string, string> = {}) {
	const encoder = new TextEncoder();
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const c of chunks) controller.enqueue(encoder.encode(c));
			controller.close();
		}
	});
	return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream', ...headers } });
}

function fakeEvent(over: { body?: unknown; cookie?: string; token?: string; params?: Record<string, string>; search?: string; referer?: string } = {}): RequestEvent {
	const headers = new Headers({ 'Content-Type': 'application/json' });
	if (over.cookie) headers.set('cookie', over.cookie);
	if (over.referer) headers.set('referer', over.referer);
	return {
		request: new Request('http://app.test/backend/opey/stream' + (over.search ?? ''), {
			method: 'POST',
			headers,
			body: over.body === undefined ? undefined : JSON.stringify(over.body)
		}),
		url: new URL('http://app.test/backend/opey/stream' + (over.search ?? '')),
		params: over.params ?? {},
		locals: { session: over.token ? { data: { oauth: { access_token: over.token } } } : undefined }
	} as unknown as RequestEvent;
}

function fakeObp() {
	const calls: Array<{ method: string; path: string; body?: any; token?: string }> = [];
	return {
		calls,
		obp: {
			get: vi.fn(async (path: string, token?: string): Promise<any> => {
				calls.push({ method: 'GET', path, token });
				if (path.includes('/my/consents')) return { consents: [{ consent_id: 'jti-1', consent_reference_id: 'ref-1' }] };
				return { notes_list: [] };
			}),
			post: vi.fn(async (path: string, body: any, token?: string): Promise<any> => {
				calls.push({ method: 'POST', path, body, token });
				return { notes: { notes_id: 'row-1' } };
			}),
			patch: vi.fn(async (path: string, body: any, token?: string): Promise<any> => {
				calls.push({ method: 'PATCH', path, body, token });
				return {};
			})
		}
	};
}

async function readAll(res: Response): Promise<string> {
	return new TextDecoder().decode(new Uint8Array(await res.arrayBuffer()));
}

// jti is the OBP consent id; header/signature are irrelevant to the decode.
const consentJwt = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ jti: 'jti-1', exp: 4102444800 })).toString('base64url') + '.sig';

describe('createOpeyProxyHandlers stream', () => {
	it('relays the SSE bytes untouched, forwards only the Opey cookie, records the turn as the user and appends the outcome', async () => {
		const { obp, calls } = fakeObp();
		const upstreamCalls: Array<{ url: string; init: RequestInit }> = [];
		const chunks = [
			sse({ type: 'user_message_confirmed', message_id: 'u1', correlation_id: 'c1', content: 'Create a bank' }),
			sse({ type: 'assistant_start', message_id: 'a1', run_id: 'r1' }),
			sse({ type: 'assistant_token', message_id: 'a1', content: 'Done' }),
			sse({ type: 'assistant_complete', message_id: 'a1', run_id: 'r1', content: 'Done.' }),
			'data: [DONE]\n\n'
		];
		const handlers = createOpeyProxyHandlers({
			opeyBaseUrl: () => 'http://opey.test',
			getAccessToken: (e) => (e.locals as any).session?.data?.oauth?.access_token,
			recording: { entityName: 'notes', obpRequests: obp },
			fetchImpl: async (url, init) => {
				upstreamCalls.push({ url: String(url), init: init! });
				return opeyStream(chunks, { 'X-Thread-ID': 'thread-1', 'Set-Cookie': 'session=abc; Path=/' });
			}
		});

		const res = await handlers.stream.POST(
			fakeEvent({ body: { message: 'Create a bank' }, cookie: 'obp-portal-connect.sid=secret; session=opey-cookie', token: 'user-token', referer: 'http://app.test/app-studio?mode=page#x' })
		);

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('text/event-stream');
		expect(res.headers.get('X-Thread-ID')).toBe('thread-1');
		expect(res.headers.get('Set-Cookie')).toBe('session=abc; Path=/');
		expect(upstreamCalls[0].url).toBe('http://opey.test/stream');
		expect((upstreamCalls[0].init.headers as Record<string, string>)['Cookie']).toBe('session=opey-cookie');

		const text = await readAll(res);
		expect(text.startsWith(chunks.join(''))).toBe(true);
		const tail = text.slice(chunks.join('').length);
		expect(JSON.parse(tail.replace(/^data: /, ''))).toEqual({ type: 'conversation_recorded', status: 'saved', entity_name: 'notes', record_id: 'row-1', message_count: 2 });

		const post = calls.find((c) => c.method === 'POST')!;
		expect(post.path).toBe('/obp/dynamic-entity/my/notes');
		expect(post.token).toBe('user-token');
		expect(post.body.thread_id).toBe('thread-1');
		expect(post.body.page).toBe('/app-studio');
		expect(JSON.parse(post.body.messages_json).map((m: any) => m.id)).toEqual(['u1', 'a1']);
	});

	it('passes anonymous sessions through without recording or appending anything', async () => {
		const { obp, calls } = fakeObp();
		const chunks = [sse({ type: 'assistant_complete', message_id: 'a1', run_id: 'r1', content: 'Hi' }), 'data: [DONE]\n\n'];
		const handlers = createOpeyProxyHandlers({
			opeyBaseUrl: () => 'http://opey.test',
			getAccessToken: () => undefined,
			recording: { entityName: 'notes', obpRequests: obp },
			fetchImpl: async () => opeyStream(chunks, { 'X-Thread-ID': 'thread-1' })
		});
		const res = await handlers.stream.POST(fakeEvent({ body: { message: 'hi' } }));
		expect(await readAll(res)).toBe(chunks.join(''));
		expect(calls).toHaveLength(0);
	});

	it('refuses anonymous callers when requireUser is set and reports an unset OPEY_BASE_URL', async () => {
		const strict = createOpeyProxyHandlers({ opeyBaseUrl: () => 'http://opey.test', getAccessToken: () => undefined, requireUser: true });
		expect((await strict.stream.POST(fakeEvent({ body: {} }))).status).toBe(401);
		const unset = createOpeyProxyHandlers({ opeyBaseUrl: () => undefined, getAccessToken: () => 'tok' });
		expect((await unset.stream.POST(fakeEvent({ body: {} }))).status).toBe(503);
	});

	it('resolves the consent reference id from a consent resume and stores it on the row', async () => {
		const { obp, calls } = fakeObp();
		const chunks = [sse({ type: 'assistant_complete', message_id: 'a2', run_id: 'r2', content: 'Bank created.' }), 'data: [DONE]\n\n'];
		const handlers = createOpeyProxyHandlers({
			opeyBaseUrl: () => 'http://opey.test',
			getAccessToken: () => 'user-token',
			recording: { entityName: 'notes', obpRequests: obp },
			fetchImpl: async () => opeyStream(chunks, { 'X-Thread-ID': 'thread-1' })
		});
		await readAll(await handlers.stream.POST(fakeEvent({ body: { message: '', thread_id: 'thread-1', tool_call_approval: { consent_jwt: consentJwt } } })));
		expect(calls.some((c) => c.method === 'GET' && c.path === '/obp/v5.1.0/my/consents' && c.token === 'user-token')).toBe(true);
		const post = calls.find((c) => c.method === 'POST')!;
		expect(post.body.consent_reference_ids).toBe('ref-1');
	});

	it('passes Opey errors back with their status so the chat can react (401 triggers re-auth)', async () => {
		const handlers = createOpeyProxyHandlers({
			opeyBaseUrl: () => 'http://opey.test',
			getAccessToken: () => 'tok',
			fetchImpl: async () => new Response(JSON.stringify({ detail: 'expired' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
		});
		const res = await handlers.stream.POST(fakeEvent({ body: { message: 'hi' } }));
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ detail: 'expired' });
	});

	it('regenerate truncates after the message id and rebuilds the row', async () => {
		const { obp, calls } = fakeObp();
		obp.get.mockImplementation(async (path: string) => {
			calls.push({ method: 'GET', path });
			return {
				notes_list: [
					{
						notes_id: 'row-7',
						thread_id: 'thread-1',
						started_at: '2026-09-01T00:00:00Z',
						messages_json: JSON.stringify([
							{ id: 'u1', role: 'user', text: 'q', at: '2026-09-01T00:00:00Z' },
							{ id: 'a1', role: 'assistant', text: 'old', at: '2026-09-01T00:00:01Z' }
						])
					}
				]
			};
		});
		const chunks = [sse({ type: 'assistant_complete', message_id: 'a2', run_id: 'r2', content: 'new' }), 'data: [DONE]\n\n'];
		const handlers = createOpeyProxyHandlers({
			opeyBaseUrl: () => 'http://opey.test',
			getAccessToken: () => 'tok',
			recording: { entityName: 'notes', obpRequests: obp },
			fetchImpl: async (url) => {
				expect(String(url)).toBe('http://opey.test/stream/thread-1/regenerate?message_id=u1');
				return opeyStream(chunks, { 'X-Thread-ID': 'thread-1' });
			}
		});
		await readAll(await handlers.regenerate.POST(fakeEvent({ params: { threadId: 'thread-1' }, search: '?message_id=u1' })));
		const patch = calls.find((c) => c.method === 'PATCH')!;
		expect(patch.path).toBe('/obp/dynamic-entity/my/notes/row-7');
		expect(JSON.parse(patch.body.messages_json).map((m: any) => [m.id, m.text])).toEqual([
			['u1', 'q'],
			['a2', 'new']
		]);
	});
});

describe('pickCookie', () => {
	it('returns only the named cookie', () => {
		expect(pickCookie('a=1; session=xyz; b=2', 'session')).toBe('session=xyz');
		expect(pickCookie('a=1', 'session')).toBeUndefined();
		expect(pickCookie(null, 'session')).toBeUndefined();
	});
});
