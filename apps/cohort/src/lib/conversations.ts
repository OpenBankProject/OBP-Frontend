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
/** One message of a recorded Opey conversation, as the shared recorder writes them into messages_json. */
export interface ConversationMessage {
	id: string;
	role: string;
	text: string;
	at: string;
}

/** The messages of a conversation record; a value that is not a JSON array of messages gives none. */
export function parseMessages(messagesJson: unknown): ConversationMessage[] {
	try {
		const parsed = JSON.parse(String(messagesJson ?? '[]'));
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((m) => m && typeof m === 'object')
			.map((m) => ({ id: String(m.id ?? ''), role: String(m.role ?? ''), text: String(m.text ?? ''), at: String(m.at ?? '') }));
	} catch {
		return [];
	}
}
