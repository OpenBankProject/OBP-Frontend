import { describe, it, expect, vi } from 'vitest';
import { ConversationRecorder } from './ConversationRecorder';
import type { BaseMessage } from '../types';

const t = new Date('2026-09-04T10:00:00Z');
const user = (id: string, text: string): BaseMessage => ({ id, role: 'user', message: text, timestamp: t }) as BaseMessage;
const assistant = (id: string, text: string, streaming = false): BaseMessage =>
	({ id, role: 'assistant', message: text, timestamp: t, isStreaming: streaming }) as BaseMessage;

function fakeFetch(responses: Array<{ status: number; body?: any }>) {
	const calls: Array<{ url: string; method: string; body: any }> = [];
	const impl = vi.fn(async (input: any, init?: any) => {
		const next = responses.shift() ?? { status: 200, body: {} };
		calls.push({ url: String(input), method: init?.method, body: init?.body ? JSON.parse(init.body) : undefined });
		return { ok: next.status < 400, status: next.status, json: async () => next.body ?? {} } as Response;
	});
	return { impl: impl as unknown as typeof fetch, calls };
}

describe('ConversationRecorder', () => {
	it('creates the row on the first completed message, then patches, and skips unchanged snapshots', async () => {
		const { impl, calls } = fakeFetch([
			{ status: 201, body: { notes: { notes_id: 'row-1' } } },
			{ status: 200, body: {} }
		]);
		const statuses: string[] = [];
		const r = new ConversationRecorder({ entityName: 'notes', fetchImpl: impl, onStatus: (s) => statuses.push(s) });

		await r.record('thread-1', [user('u1', 'hello'), assistant('a1', 'thinking', true)]);
		expect(calls).toHaveLength(1);
		expect(calls[0].method).toBe('POST');
		expect(calls[0].url).toBe('/proxy/obp/dynamic-entity/my/notes');
		expect(calls[0].body.message_count).toBe(1);

		await r.record('thread-1', [user('u1', 'hello'), assistant('a1', 'thinking', true)]);
		expect(calls).toHaveLength(1);

		await r.record('thread-1', [user('u1', 'hello'), assistant('a1', 'answer')], ['ref-9']);
		expect(calls).toHaveLength(2);
		expect(calls[1].method).toBe('PATCH');
		expect(calls[1].url).toBe('/proxy/obp/dynamic-entity/my/notes/row-1');
		expect(calls[1].body.message_count).toBe(2);
		expect(calls[1].body.consent_reference_ids).toBe('ref-9');
		expect(statuses).toEqual(['saved', 'saved']);
	});

	it('stops after a 404 on create and reports unavailable', async () => {
		const { impl, calls } = fakeFetch([{ status: 404, body: { message: 'no such entity' } }]);
		const statuses: string[] = [];
		const r = new ConversationRecorder({ entityName: 'notes', fetchImpl: impl, onStatus: (s) => statuses.push(s) });
		await r.record('thread-1', [user('u1', 'hello')]);
		await r.record('thread-1', [user('u1', 'hello'), assistant('a1', 'answer')]);
		expect(calls).toHaveLength(1);
		expect(statuses).toEqual(['unavailable']);
	});

	it('reports other failures and retries on the next change', async () => {
		const { impl, calls } = fakeFetch([
			{ status: 403, body: { message: 'OBP-20006' } },
			{ status: 201, body: { notes: { notes_id: 'row-2' } } }
		]);
		const statuses: string[] = [];
		const r = new ConversationRecorder({ entityName: 'notes', fetchImpl: impl, onStatus: (s) => statuses.push(s) });
		await r.record('thread-1', [user('u1', 'hello')]);
		await r.record('thread-1', [user('u1', 'hello'), assistant('a1', 'answer')]);
		expect(calls.map((c) => c.method)).toEqual(['POST', 'POST']);
		expect(statuses).toEqual(['error', 'saved']);
	});

	it('does nothing without a thread id or completed messages', async () => {
		const { impl, calls } = fakeFetch([]);
		const r = new ConversationRecorder({ entityName: 'notes', fetchImpl: impl });
		await r.record('', [user('u1', 'hello')]);
		await r.record('thread-1', [assistant('a1', 'thinking', true)]);
		expect(calls).toHaveLength(0);
	});
});
