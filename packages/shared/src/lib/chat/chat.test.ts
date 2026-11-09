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
import { describe, expect, it } from 'vitest';
import { isDirectMessage } from './room';
import { chatApiPaths } from './paths';
import { CHAT_LABELS, chatMessage } from './labels';
import { chatProxyAllows } from '../server/chat/proxy';
import { extractJoiningKey } from '../server/chat/pages';

describe('chat paths', () => {
	it('are the system-wide rooms for the Portal', () => {
		const p = chatApiPaths({ kind: 'system' });
		expect(p.rooms).toBe('/obp/v6.0.0/chat-rooms');
		expect(p.reaction('r1', 'm1', '👍')).toBe(`/obp/v6.0.0/chat-rooms/r1/messages/m1/reactions/${encodeURIComponent('👍')}`);
		expect(p.join).toBe('/obp/v6.0.0/chat-room-participants');
	});

	it("are one bank's rooms for an app's own", () => {
		const p = chatApiPaths({ kind: 'bank', bankId: 'cohort' });
		expect(p.rooms).toBe('/obp/v6.0.0/banks/cohort/chat-rooms');
		expect(p.messages('r1')).toBe('/obp/v6.0.0/banks/cohort/chat-rooms/r1/messages');
		expect(p.joiningKey('r1')).toBe('/obp/v6.0.0/banks/cohort/chat-rooms/r1/joining-key');
		expect(p.join).toBe('/obp/v6.0.0/banks/cohort/chat-room-participants');
		expect(p.readMarker('r1')).toBe('/obp/v6.0.0/users/current/chat-rooms/r1/read-marker');
	});
});

describe('chatProxyAllows', () => {
	const cohort = { kind: 'bank', bankId: 'cohort' } as const;
	it("lets through only the scope's rooms and read markers", () => {
		expect(chatProxyAllows(cohort, 'v6.0.0/banks/cohort/chat-rooms/r1/messages')).toBe(true);
		expect(chatProxyAllows(cohort, 'v6.0.0/users/current/chat-rooms/r1/read-marker')).toBe(true);
		expect(chatProxyAllows(cohort, 'v6.0.0/banks/other/chat-rooms/r1/messages')).toBe(false);
		expect(chatProxyAllows(cohort, 'v6.0.0/chat-rooms/r1/messages')).toBe(false);
		expect(chatProxyAllows(cohort, 'v6.0.0/banks/cohort/chat-rooms')).toBe(false);
		expect(chatProxyAllows(cohort, 'v5.1.0/users/current')).toBe(false);
		expect(chatProxyAllows(cohort, 'v6.0.0/users/current/chat-rooms/r1/read-marker/x')).toBe(false);
	});
});

describe('chat labels', () => {
	it('has every English label in Arabic', () => {
		expect(Object.keys(CHAT_LABELS.ar).sort()).toEqual(Object.keys(CHAT_LABELS.en).sort());
	});

	it("shows a code's label, else OBP-API's own message", () => {
		expect(chatMessage(CHAT_LABELS.ar, { code: 'msg_created', message: 'Chat room created successfully.' })).toBe(CHAT_LABELS.ar.msg_created);
		expect(chatMessage(CHAT_LABELS.en, { message: 'OBP-39015: link not allowed' })).toBe('OBP-39015: link not allowed');
		expect(chatMessage(CHAT_LABELS.en, null)).toBe('');
	});
});

describe('extractJoiningKey', () => {
	it('takes the key from a join link, or the input as it is', () => {
		expect(extractJoiningKey('https://cohort.example.com/discussions/join?joining_key=abc')).toBe('abc');
		expect(extractJoiningKey('abc')).toBe('abc');
	});
});

describe('isDirectMessage', () => {
	it('is a private system room of two, never a room at a bank', () => {
		expect(isDirectMessage({ bank_id: '', is_open_room: false, participant_count: 2 })).toBe(true);
		expect(isDirectMessage({ is_open_room: false, participant_count: 2 })).toBe(true);
		expect(isDirectMessage({ bank_id: 'cohort', is_open_room: false, participant_count: 2 })).toBe(false);
		expect(isDirectMessage({ bank_id: '', is_open_room: true, participant_count: 2 })).toBe(false);
		expect(isDirectMessage({ bank_id: '', is_open_room: false, participant_count: 3 })).toBe(false);
	});
});
