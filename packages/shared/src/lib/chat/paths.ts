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
 * Where a set of chat rooms lives at OBP-API: the system-wide rooms (the Portal's), or one bank's rooms (an app's own,
 * e.g. Cohort's at its bank_id). The same pages and components serve both; only these paths differ.
 */
export type ChatScope = { kind: 'system' } | { kind: 'bank'; bankId: string };

const V = '/obp/v6.0.0';

/** The OBP-API paths of the chat endpoints for a scope. */
export function chatApiPaths(scope: ChatScope) {
	const rooms = scope.kind === 'bank' ? `${V}/banks/${encodeURIComponent(scope.bankId)}/chat-rooms` : `${V}/chat-rooms`;
	const room = (id: string) => `${rooms}/${encodeURIComponent(id)}`;
	const message = (roomId: string, messageId: string) => `${room(roomId)}/messages/${encodeURIComponent(messageId)}`;
	return {
		rooms,
		room,
		messages: (id: string) => `${room(id)}/messages`,
		/** One message: where it is edited. */
		message,
		participants: (id: string) => `${room(id)}/participants`,
		/** One participant: where they are removed. */
		participant: (roomId: string, userId: string) => `${room(roomId)}/participants/${encodeURIComponent(userId)}`,
		joiningKey: (id: string) => `${room(id)}/joining-key`,
		reactions: (roomId: string, messageId: string) => `${message(roomId, messageId)}/reactions`,
		reaction: (roomId: string, messageId: string, emoji: string) => `${message(roomId, messageId)}/reactions/${encodeURIComponent(emoji)}`,
		/** Joining with a joining key. */
		join: scope.kind === 'bank' ? `${V}/banks/${encodeURIComponent(scope.bankId)}/chat-room-participants` : `${V}/chat-room-participants`,
		/** Finding rooms by participant: system rooms only, so direct messages are system rooms. */
		search: `${V}/chat-rooms/search`,
		/** The current User's rooms, of every scope. */
		myRooms: `${V}/users/current/chat-rooms`,
		readMarker: (id: string) => `${V}/users/current/chat-rooms/${encodeURIComponent(id)}/read-marker`
	};
}

export type ChatApiPaths = ReturnType<typeof chatApiPaths>;
