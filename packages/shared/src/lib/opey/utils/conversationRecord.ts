/**
 * Opey conversation records: the chat, written by the app as the logged-in user into a
 * personal dynamic entity after each message completes. Rows are the user's own (they
 * appear under My Data); Opey and its consent are never involved in the write.
 *
 * Pure helpers here; the network side is ConversationRecorder.
 */
import type { BaseMessage } from '../types';

export interface RecordedMessage {
	id: string;
	role: 'user' | 'assistant';
	text: string;
	/** ISO timestamp. */
	at: string;
}

/** The record as stored (dynamic entity fields are scalars, so messages travel as JSON text). */
export interface ConversationRow {
	thread_id: string;
	title: string;
	status: string;
	started_at: string;
	updated_at: string;
	message_count: number;
	messages_json: string;
	/** Comma-separated consent_reference_ids used in this chat, for the metrics dashboards. */
	consent_reference_ids: string;
}

const TITLE_MAX = 120;

function iso(d: Date | string | undefined): string {
	const date = d instanceof Date ? d : d ? new Date(d) : new Date();
	return (isNaN(date.getTime()) ? new Date() : date).toISOString().split('.')[0] + 'Z';
}

/**
 * Messages that are finished: user messages once the backend confirmed them, assistant
 * messages once streaming ended with some text. Tool, error and approval messages are not
 * part of the transcript.
 */
export function completedMessages(messages: BaseMessage[]): RecordedMessage[] {
	const out: RecordedMessage[] = [];
	for (const m of messages) {
		if (m.role === 'user') {
			if (m.isPending) continue;
			if (!m.message?.trim()) continue;
			out.push({ id: m.id, role: 'user', text: m.message, at: iso(m.timestamp) });
		} else if (m.role === 'assistant') {
			if (m.isStreaming || m.isLoading) continue;
			if (!m.message?.trim()) continue;
			out.push({ id: m.id, role: 'assistant', text: m.message, at: iso(m.timestamp) });
		}
	}
	return out;
}

export function conversationTitle(messages: RecordedMessage[]): string {
	const first = messages.find((m) => m.role === 'user')?.text.trim().replace(/\s+/g, ' ') ?? '';
	return first.length > TITLE_MAX ? first.slice(0, TITLE_MAX - 1) + '…' : first || 'Untitled conversation';
}

export function buildConversationRow(
	threadId: string,
	messages: RecordedMessage[],
	consentReferenceIds: string[],
	startedAt?: string,
	now: Date = new Date()
): ConversationRow {
	const started = startedAt ?? messages[0]?.at ?? iso(now);
	return {
		thread_id: threadId,
		title: conversationTitle(messages),
		status: 'active',
		started_at: started,
		updated_at: iso(now),
		message_count: messages.length,
		messages_json: JSON.stringify(messages),
		consent_reference_ids: Array.from(new Set(consentReferenceIds.filter(Boolean))).join(',')
	};
}
