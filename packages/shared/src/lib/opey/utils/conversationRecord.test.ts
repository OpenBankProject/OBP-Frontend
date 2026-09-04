import { describe, it, expect } from 'vitest';
import { buildConversationRow, completedMessages, conversationTitle } from './conversationRecord';
import type { BaseMessage } from '../types';

const t = new Date('2026-09-04T10:00:00Z');
const msg = (over: Partial<BaseMessage>): BaseMessage =>
	({ id: 'x', role: 'user', message: 'hi', timestamp: t, ...over }) as BaseMessage;

describe('completedMessages', () => {
	it('keeps confirmed user messages and finished assistant messages only', () => {
		const out = completedMessages([
			msg({ id: 'u1', role: 'user', message: 'Create a bank' }),
			msg({ id: 'u2', role: 'user', message: 'pending', isPending: true }),
			msg({ id: 't1', role: 'tool', message: '{}' }),
			msg({ id: 'a1', role: 'assistant', message: 'Working…', isStreaming: true }),
			msg({ id: 'a2', role: 'assistant', message: '', isLoading: true }),
			msg({ id: 'a3', role: 'assistant', message: 'Done.' }),
			msg({ id: 'e1', role: 'error', message: 'boom' })
		]);
		expect(out.map((m) => m.id)).toEqual(['u1', 'a3']);
		expect(out[0]).toEqual({ id: 'u1', role: 'user', text: 'Create a bank', at: '2026-09-04T10:00:00Z' });
	});
});

describe('conversationTitle / buildConversationRow', () => {
	it('titles from the first user message and serialises messages as JSON text', () => {
		const messages = completedMessages([
			msg({ id: 'u1', role: 'user', message: '  Create   a bank please ' }),
			msg({ id: 'a1', role: 'assistant', message: 'Done.' })
		]);
		expect(conversationTitle(messages)).toBe('Create a bank please');
		const row = buildConversationRow('thread-1', messages, ['ref-1', 'ref-1', ''], undefined, t);
		expect(row.thread_id).toBe('thread-1');
		expect(row.status).toBe('active');
		expect(row.started_at).toBe('2026-09-04T10:00:00Z');
		expect(row.updated_at).toBe('2026-09-04T10:00:00Z');
		expect(row.message_count).toBe(2);
		expect(JSON.parse(row.messages_json)).toHaveLength(2);
		expect(row.consent_reference_ids).toBe('ref-1');
	});

	it('truncates long titles and falls back when there is no user message', () => {
		const long = 'x'.repeat(200);
		expect(conversationTitle([{ id: 'u', role: 'user', text: long, at: '' }]).length).toBe(120);
		expect(conversationTitle([])).toBe('Untitled conversation');
	});
});
