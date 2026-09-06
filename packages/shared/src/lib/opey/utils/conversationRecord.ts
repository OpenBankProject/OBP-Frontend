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
 * Opey conversation records: the chat, written by the app as the logged-in user into a
 * personal dynamic entity after each turn completes. Rows are the user's own (they
 * appear under My Data); Opey and its consent are never involved in the write.
 *
 * Pure helpers here. The pieces that talk to the network live under ../recording and are
 * driven from the app's server-side Opey proxy, the one place every chat passes through.
 */

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
	/** Path of the page the chat was embedded in, without query string; '' when unknown. */
	page: string;
}

const TITLE_MAX = 120;

/**
 * ISO 8601 without milliseconds (OBP drops `.000Z` strings silently). Accepts a Date, an
 * ISO string, or an epoch number: Opey stamps its SSE events in epoch seconds, so numbers
 * below 1e12 are read as seconds, larger ones as milliseconds. Anything unparseable, or
 * nothing at all, means "now".
 */
export function isoTimestamp(value: Date | string | number | undefined | null, now: Date = new Date()): string {
	let date: Date;
	if (value instanceof Date) date = value;
	else if (typeof value === 'number') date = new Date(value < 1e12 ? value * 1000 : value);
	else if (typeof value === 'string' && value) date = new Date(value);
	else date = now;
	if (isNaN(date.getTime())) date = now;
	return date.toISOString().split('.')[0] + 'Z';
}

export function conversationTitle(messages: RecordedMessage[]): string {
	const first = messages.find((m) => m.role === 'user')?.text.trim().replace(/\s+/g, ' ') ?? '';
	return first.length > TITLE_MAX ? first.slice(0, TITLE_MAX - 1) + '…' : first || 'Untitled conversation';
}

/** Add messages to a transcript: a message whose id is already present replaces it in place. */
export function mergeMessages(existing: RecordedMessage[], incoming: RecordedMessage[]): RecordedMessage[] {
	const out = [...existing];
	for (const m of incoming) {
		const i = out.findIndex((e) => e.id === m.id);
		if (i >= 0) out[i] = m;
		else out.push(m);
	}
	return out;
}

/** Drop everything after the message with this id (regenerate). Unknown id: unchanged. */
export function truncateAfter(messages: RecordedMessage[], messageId: string | undefined): RecordedMessage[] {
	if (!messageId) return messages;
	const i = messages.findIndex((m) => m.id === messageId);
	return i >= 0 ? messages.slice(0, i + 1) : messages;
}

/** Parse a stored messages_json; anything malformed reads as an empty transcript. */
export function parseMessagesJson(text: unknown): RecordedMessage[] {
	if (typeof text !== 'string' || !text) return [];
	try {
		const parsed = JSON.parse(text);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(m: any): m is RecordedMessage =>
				m && typeof m.id === 'string' && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string'
		);
	} catch {
		return [];
	}
}

export function buildConversationRow(
	threadId: string,
	messages: RecordedMessage[],
	consentReferenceIds: string[],
	startedAt?: string,
	now: Date = new Date(),
	page: string = ''
): ConversationRow {
	const started = startedAt ?? messages[0]?.at ?? isoTimestamp(now);
	return {
		thread_id: threadId,
		title: conversationTitle(messages),
		status: 'active',
		started_at: started,
		updated_at: isoTimestamp(now),
		message_count: messages.length,
		messages_json: JSON.stringify(messages),
		consent_reference_ids: Array.from(new Set(consentReferenceIds.filter(Boolean))).join(','),
		page
	};
}

/**
 * The page path a same-origin request came from, taken from its Referer: path only, no
 * origin, no query string or fragment. '' when there is no usable Referer.
 */
export function pageFromReferer(referer: string | null | undefined): string {
	if (!referer) return '';
	try {
		const url = new URL(referer);
		return url.pathname.slice(0, 500);
	} catch {
		return '';
	}
}
