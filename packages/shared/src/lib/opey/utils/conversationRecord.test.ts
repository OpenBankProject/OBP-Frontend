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
import { describe, it, expect } from 'vitest';
import {
	buildConversationRow,
	conversationTitle,
	isoTimestamp,
	mergeMessages,
	pageFromReferer,
	parseMessagesJson,
	truncateAfter,
	type RecordedMessage
} from './conversationRecord';

const t = new Date('2026-09-04T10:00:00Z');
const m = (id: string, role: 'user' | 'assistant', text: string): RecordedMessage => ({ id, role, text, at: '2026-09-04T10:00:00Z' });

describe('isoTimestamp', () => {
	it('drops milliseconds and reads epoch seconds, epoch millis, ISO strings and dates', () => {
		expect(isoTimestamp(t)).toBe('2026-09-04T10:00:00Z');
		expect(isoTimestamp('2026-09-04T10:00:00.123Z')).toBe('2026-09-04T10:00:00Z');
		expect(isoTimestamp(1788000000)).toBe('2026-08-29T10:40:00Z');
		expect(isoTimestamp(1788000000123)).toBe('2026-08-29T10:40:00Z');
		expect(isoTimestamp('not a date', t)).toBe('2026-09-04T10:00:00Z');
		expect(isoTimestamp(undefined, t)).toBe('2026-09-04T10:00:00Z');
	});
});

describe('mergeMessages / truncateAfter / parseMessagesJson', () => {
	it('appends new ids and replaces existing ones in place', () => {
		const out = mergeMessages([m('u1', 'user', 'q'), m('a1', 'assistant', 'old')], [m('a1', 'assistant', 'new'), m('u2', 'user', 'more')]);
		expect(out.map((x) => [x.id, x.text])).toEqual([
			['u1', 'q'],
			['a1', 'new'],
			['u2', 'more']
		]);
	});

	it('truncates after a known id and leaves the list alone otherwise', () => {
		const list = [m('u1', 'user', 'q'), m('a1', 'assistant', 'a'), m('u2', 'user', 'q2')];
		expect(truncateAfter(list, 'u1').map((x) => x.id)).toEqual(['u1']);
		expect(truncateAfter(list, 'nope')).toBe(list);
		expect(truncateAfter(list, undefined)).toBe(list);
	});

	it('parses stored JSON defensively', () => {
		expect(parseMessagesJson(JSON.stringify([m('u1', 'user', 'q'), { id: 'bad' }, null]))).toEqual([m('u1', 'user', 'q')]);
		expect(parseMessagesJson('{oops')).toEqual([]);
		expect(parseMessagesJson(undefined)).toEqual([]);
	});
});

describe('conversationTitle / buildConversationRow', () => {
	it('titles from the first user message and serialises messages as JSON text', () => {
		const messages = [m('u1', 'user', '  Create   a bank please '), m('a1', 'assistant', 'Done.')];
		expect(conversationTitle(messages)).toBe('Create a bank please');
		const row = buildConversationRow('thread-1', messages, ['ref-1', 'ref-1', ''], undefined, t);
		expect(row.thread_id).toBe('thread-1');
		expect(row.status).toBe('active');
		expect(row.started_at).toBe('2026-09-04T10:00:00Z');
		expect(row.updated_at).toBe('2026-09-04T10:00:00Z');
		expect(row.message_count).toBe(2);
		expect(JSON.parse(row.messages_json)).toHaveLength(2);
		expect(row.consent_reference_ids).toBe('ref-1');
		expect(row.page).toBe('');
		expect(buildConversationRow('t', messages, [], undefined, t, '/faq').page).toBe('/faq');
	});

	it('takes the page path from a Referer, dropping origin, query and fragment', () => {
		expect(pageFromReferer('https://portal.example/app-studio?mode=page#top')).toBe('/app-studio');
		expect(pageFromReferer('http://localhost:5174/')).toBe('/');
		expect(pageFromReferer('garbage')).toBe('');
		expect(pageFromReferer(null)).toBe('');
	});

	it('keeps a given started_at, truncates long titles and falls back when there is no user message', () => {
		expect(buildConversationRow('t', [m('a1', 'assistant', 'x')], [], '2026-01-01T00:00:00Z', t).started_at).toBe('2026-01-01T00:00:00Z');
		const long = 'x'.repeat(200);
		expect(conversationTitle([{ id: 'u', role: 'user', text: long, at: '' }]).length).toBe(120);
		expect(conversationTitle([])).toBe('Untitled conversation');
	});
});
