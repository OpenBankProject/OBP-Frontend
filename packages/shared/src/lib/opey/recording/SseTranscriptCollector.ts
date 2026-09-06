/**
 * Reads Opey's server-sent events as they stream past the app's proxy and keeps the
 * messages that completed in this turn: the user message once Opey confirmed it, and
 * each assistant message once its `assistant_complete` arrived. Tool calls, approval and
 * consent cards, errors and partial (cancelled) assistant text are not part of the
 * transcript.
 *
 * Pure: feed it bytes or text, ask for `completed()`. The proxy does the network side.
 */
import { isoTimestamp, mergeMessages, type RecordedMessage } from '../utils/conversationRecord';

export class SseTranscriptCollector {
	private readonly decoder = new TextDecoder();
	private buffer = '';
	private messages: RecordedMessage[] = [];
	private readonly assistantText = new Map<string, string>();
	private readonly assistantStartedAt = new Map<string, string>();
	private done = false;

	/** Feed the next chunk exactly as it came from Opey. */
	feed(chunk: Uint8Array | string): void {
		this.buffer += typeof chunk === 'string' ? chunk : this.decoder.decode(chunk, { stream: true });
		const lines = this.buffer.split('\n');
		this.buffer = lines.pop() ?? '';
		for (const line of lines) this.handleLine(line);
	}

	/** Flush whatever is left once the upstream stream has ended. */
	end(): void {
		this.buffer += this.decoder.decode();
		if (this.buffer) this.handleLine(this.buffer);
		this.buffer = '';
	}

	/** Did Opey send its `[DONE]` marker? */
	get sawDone(): boolean {
		return this.done;
	}

	/** Messages that completed in this turn, in the order they completed. */
	completed(): RecordedMessage[] {
		return [...this.messages];
	}

	private handleLine(line: string): void {
		const trimmed = line.replace(/\r$/, '');
		if (!trimmed.startsWith('data:')) return;
		const payload = trimmed.slice(5).trim();
		if (!payload) return;
		if (payload === '[DONE]') {
			this.done = true;
			return;
		}
		let event: any;
		try {
			event = JSON.parse(payload);
		} catch {
			return;
		}
		if (event && typeof event === 'object') this.handleEvent(event);
	}

	private handleEvent(event: any): void {
		const id = typeof event.message_id === 'string' ? event.message_id : '';
		switch (event.type) {
			case 'user_message_confirmed': {
				const text = typeof event.content === 'string' ? event.content : '';
				if (!id || !text.trim()) return;
				this.upsert({ id, role: 'user', text, at: isoTimestamp(event.timestamp) });
				return;
			}
			case 'assistant_start':
				if (!id) return;
				this.assistantText.set(id, '');
				this.assistantStartedAt.set(id, isoTimestamp(event.timestamp));
				return;
			case 'assistant_token':
				if (!id || typeof event.content !== 'string') return;
				this.assistantText.set(id, (this.assistantText.get(id) ?? '') + event.content);
				return;
			case 'assistant_complete': {
				if (!id) return;
				// The complete event carries the whole text; the tokens are the fallback.
				const text =
					typeof event.content === 'string' && event.content.trim() ? event.content : (this.assistantText.get(id) ?? '');
				this.assistantText.delete(id);
				const at = this.assistantStartedAt.get(id) ?? isoTimestamp(event.timestamp);
				this.assistantStartedAt.delete(id);
				if (!text.trim()) return;
				this.upsert({ id, role: 'assistant', text, at });
				return;
			}
			default:
				return;
		}
	}

	private upsert(message: RecordedMessage): void {
		this.messages = mergeMessages(this.messages, [message]);
	}
}
