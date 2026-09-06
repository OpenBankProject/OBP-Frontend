import { describe, it, expect } from 'vitest';
import { SseTranscriptCollector } from './SseTranscriptCollector';

const sse = (event: Record<string, unknown>) => `data: ${JSON.stringify(event)}\n\n`;

describe('SseTranscriptCollector', () => {
	it('keeps the confirmed user message and completed assistant messages, in order', () => {
		const c = new SseTranscriptCollector();
		c.feed(sse({ type: 'user_message_confirmed', message_id: 'u1', correlation_id: 'c1', content: 'Create a bank', timestamp: 1788000000 }));
		c.feed(sse({ type: 'assistant_start', message_id: 'a1', run_id: 'r1', timestamp: 1788000001.5 }));
		c.feed(sse({ type: 'assistant_token', message_id: 'a1', content: 'Sure' }));
		c.feed(sse({ type: 'tool_start', tool_call_id: 't1', tool_name: 'create_bank', tool_input: {} }));
		c.feed(sse({ type: 'tool_complete', tool_call_id: 't1', tool_name: 'create_bank', tool_output: '{}', status: 'success' }));
		c.feed(sse({ type: 'assistant_token', message_id: 'a1', content: ', done.' }));
		c.feed(sse({ type: 'assistant_complete', message_id: 'a1', run_id: 'r1', content: 'Sure, done.' }));
		c.feed('data: [DONE]\n\n');
		c.end();

		expect(c.sawDone).toBe(true);
		expect(c.completed()).toEqual([
			{ id: 'u1', role: 'user', text: 'Create a bank', at: '2026-08-29T10:40:00Z' },
			{ id: 'a1', role: 'assistant', text: 'Sure, done.', at: '2026-08-29T10:40:01Z' }
		]);
	});

	it('reassembles events split across chunks and falls back to the tokens when complete has no content', () => {
		const c = new SseTranscriptCollector();
		const whole = sse({ type: 'assistant_start', message_id: 'a1', run_id: 'r1' }) + sse({ type: 'assistant_token', message_id: 'a1', content: 'Hel' }) + sse({ type: 'assistant_token', message_id: 'a1', content: 'lo' }) + sse({ type: 'assistant_complete', message_id: 'a1', run_id: 'r1', content: '' });
		const bytes = new TextEncoder().encode(whole);
		for (let i = 0; i < bytes.length; i += 7) c.feed(bytes.slice(i, i + 7));
		c.end();
		expect(c.completed()).toEqual([expect.objectContaining({ id: 'a1', role: 'assistant', text: 'Hello' })]);
	});

	it('ignores partial assistant text, blank messages, malformed lines and comments', () => {
		const c = new SseTranscriptCollector();
		c.feed(': keep-alive\n\n');
		c.feed('data: {not json}\n\n');
		c.feed(sse({ type: 'user_message_confirmed', message_id: 'u1', correlation_id: 'c1', content: '   ' }));
		c.feed(sse({ type: 'assistant_start', message_id: 'a1', run_id: 'r1' }));
		c.feed(sse({ type: 'assistant_token', message_id: 'a1', content: 'partial' }));
		c.end();
		expect(c.completed()).toEqual([]);
		expect(c.sawDone).toBe(false);
	});

	it('replaces a message that completes twice with the same id', () => {
		const c = new SseTranscriptCollector();
		c.feed(sse({ type: 'assistant_complete', message_id: 'a1', run_id: 'r1', content: 'first' }));
		c.feed(sse({ type: 'assistant_complete', message_id: 'a1', run_id: 'r2', content: 'second' }));
		expect(c.completed().map((m) => m.text)).toEqual(['second']);
	});
});
