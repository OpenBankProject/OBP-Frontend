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
import { describe, it, expect, vi } from 'vitest';
import { ConversationRowStore, type ConversationObpRequests } from './ConversationRowStore';
import type { RecordedMessage } from '../utils/conversationRecord';

const at = '2026-09-06T10:00:00Z';
const user = (id: string, text: string): RecordedMessage => ({ id, role: 'user', text, at });
const assistant = (id: string, text: string): RecordedMessage => ({ id, role: 'assistant', text, at });
const now = () => new Date('2026-09-06T10:05:00Z');

class NotFound extends Error {
	code = '404';
}

function fakeObp(overrides: Partial<ConversationObpRequests> = {}) {
	const calls: Array<{ method: string; path: string; body?: any; token?: string }> = [];
	const obp: ConversationObpRequests = {
		get: vi.fn(async (path, token) => {
			calls.push({ method: 'GET', path, token });
			return { notes_list: [] };
		}),
		post: vi.fn(async (path, body, token) => {
			calls.push({ method: 'POST', path, body, token });
			return { notes: { notes_id: 'row-1', ...body } };
		}),
		patch: vi.fn(async (path, body, token) => {
			calls.push({ method: 'PATCH', path, body, token });
			return { notes: { notes_id: 'row-1', ...body } };
		}),
		...overrides
	};
	return { obp, calls };
}

describe('ConversationRowStore', () => {
	it('creates the row on the first turn and patches it with the merged transcript on the next', async () => {
		const { obp, calls } = fakeObp();
		const store = new ConversationRowStore('notes', obp, { now });

		const first = await store.append({ accessToken: 'tok', threadId: 't1', messages: [user('u1', 'Create a bank'), assistant('a1', 'Done.')] });
		expect(first).toEqual({ status: 'saved', recordId: 'row-1', messageCount: 2 });
		expect(calls.map((c) => c.method)).toEqual(['GET', 'POST']);
		expect(calls[1].path).toBe('/obp/dynamic-entity/my/notes');
		expect(calls[1].token).toBe('tok');
		expect(calls[1].body.title).toBe('Create a bank');
		expect(calls[1].body.started_at).toBe(at);

		const second = await store.append({ accessToken: 'tok', threadId: 't1', messages: [user('u2', 'Thanks'), assistant('a2', 'Welcome.')], consentReferenceIds: ['ref-1'] });
		expect(second).toEqual({ status: 'saved', recordId: 'row-1', messageCount: 4 });
		expect(calls[2].method).toBe('PATCH');
		expect(calls[2].path).toBe('/obp/dynamic-entity/my/notes/row-1');
		expect(JSON.parse(calls[2].body.messages_json).map((m: RecordedMessage) => m.id)).toEqual(['u1', 'a1', 'u2', 'a2']);
		expect(calls[2].body.consent_reference_ids).toBe('ref-1');
		expect(calls[2].body.started_at).toBe(at);
		// The row was cached after the first write: no second listing.
		expect(calls.filter((c) => c.method === 'GET')).toHaveLength(1);
	});

	it('finds a row another instance wrote by listing and matching thread_id', async () => {
		const { obp, calls } = fakeObp({
			get: vi.fn(async () => ({
				notes_list: [
					{ notes_id: 'row-9', thread_id: 't9', started_at: '2026-09-01T00:00:00Z', messages_json: JSON.stringify([user('u1', 'earlier')]), consent_reference_ids: 'ref-a' }
				]
			}))
		});
		const store = new ConversationRowStore('notes', obp, { now });
		const out = await store.append({ accessToken: 'tok', threadId: 't9', messages: [assistant('a1', 'later')], consentReferenceIds: ['ref-b'] });
		expect(out).toEqual({ status: 'saved', recordId: 'row-9', messageCount: 2 });
		const patch = calls.find((c) => c.method === 'PATCH')!;
		expect(patch.path).toBe('/obp/dynamic-entity/my/notes/row-9');
		expect(patch.body.started_at).toBe('2026-09-01T00:00:00Z');
		expect(patch.body.consent_reference_ids).toBe('ref-a,ref-b');
	});

	it('truncates after the regenerated message and replaces messages by id', async () => {
		const { obp, calls } = fakeObp();
		const store = new ConversationRowStore('notes', obp, { now });
		await store.append({ accessToken: 'tok', threadId: 't1', messages: [user('u1', 'q'), assistant('a1', 'old answer')] });
		await store.append({ accessToken: 'tok', threadId: 't1', messages: [assistant('a2', 'new answer')], truncateAfterMessageId: 'u1' });
		const patch = calls.find((c) => c.method === 'PATCH')!;
		expect(JSON.parse(patch.body.messages_json).map((m: RecordedMessage) => [m.id, m.text])).toEqual([
			['u1', 'q'],
			['a2', 'new answer']
		]);
	});

	it('skips when nothing completed or nothing changed, without touching OBP', async () => {
		const { obp, calls } = fakeObp();
		const store = new ConversationRowStore('notes', obp, { now });
		expect(await store.append({ accessToken: 'tok', threadId: 't1', messages: [] })).toEqual({ status: 'skipped', reason: 'no completed messages' });
		expect(calls.filter((c) => c.method !== 'GET')).toHaveLength(0);
		await store.append({ accessToken: 'tok', threadId: 't1', messages: [user('u1', 'hi')] });
		expect(await store.append({ accessToken: 'tok', threadId: 't1', messages: [user('u1', 'hi')] })).toEqual({ status: 'skipped', reason: 'unchanged' });
		expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(0);
		expect(await store.append({ accessToken: 'tok', threadId: '', messages: [user('u1', 'hi')] })).toEqual({ status: 'skipped', reason: 'no thread id' });
	});

	it('keeps the latest known page on the row and writes when only the page changed', async () => {
		const { obp, calls } = fakeObp();
		const store = new ConversationRowStore('notes', obp, { now });
		await store.append({ accessToken: 'tok', threadId: 't1', messages: [user('u1', 'hi')], page: '/app-studio' });
		expect(calls.find((c) => c.method === 'POST')!.body.page).toBe('/app-studio');
		// No page on a resume: the stored one stays.
		expect(await store.append({ accessToken: 'tok', threadId: 't1', messages: [user('u1', 'hi')] })).toEqual({ status: 'skipped', reason: 'unchanged' });
		await store.append({ accessToken: 'tok', threadId: 't1', messages: [user('u1', 'hi')], page: '/reports/1' });
		expect(calls.find((c) => c.method === 'PATCH')!.body.page).toBe('/reports/1');
	});

	it('reports a missing entity once and stays quiet until the retry window passes', async () => {
		let clock = now().getTime();
		const { obp, calls } = fakeObp({
			get: vi.fn(async () => {
				calls.push({ method: 'GET', path: 'x' });
				throw new NotFound('OBP-30217: DynamicEntity not found');
			})
		});
		const store = new ConversationRowStore('notes', obp, { now: () => new Date(clock), unavailableRetryMs: 60_000 });
		const first = await store.append({ accessToken: 'tok', threadId: 't1', messages: [user('u1', 'hi')] });
		expect(first.status).toBe('unavailable');
		const second = await store.append({ accessToken: 'tok', threadId: 't1', messages: [user('u1', 'hi')] });
		expect(second.status).toBe('unavailable');
		expect(calls).toHaveLength(1);
		clock += 61_000;
		await store.append({ accessToken: 'tok', threadId: 't1', messages: [user('u1', 'hi')] });
		expect(calls).toHaveLength(2);
	});

	it('returns other failures as error outcomes and never throws', async () => {
		const { obp } = fakeObp({
			post: vi.fn(async () => {
				throw new Error('boom');
			})
		});
		const store = new ConversationRowStore('notes', obp, { now });
		expect(await store.append({ accessToken: 'tok', threadId: 't1', messages: [user('u1', 'hi')] })).toEqual({ status: 'error', detail: 'boom' });
	});

	it('serialises writes for one thread so a fast follow-up cannot overtake the create', async () => {
		let release!: () => void;
		const gate = new Promise<void>((r) => (release = r));
		const { obp, calls } = fakeObp({
			post: vi.fn(async (path, body) => {
				calls.push({ method: 'POST', path, body });
				await gate;
				return { notes: { notes_id: 'row-1' } };
			})
		});
		const store = new ConversationRowStore('notes', obp, { now });
		const a = store.append({ accessToken: 'tok', threadId: 't1', messages: [user('u1', 'hi')] });
		const b = store.append({ accessToken: 'tok', threadId: 't1', messages: [assistant('a1', 'hello')] });
		release();
		await Promise.all([a, b]);
		expect(calls.map((c) => c.method)).toEqual(['GET', 'POST', 'PATCH']);
		expect(JSON.parse(calls[2].body.messages_json)).toHaveLength(2);
	});
});
