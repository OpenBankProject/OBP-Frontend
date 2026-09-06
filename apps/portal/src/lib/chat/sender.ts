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
 * A chat message can be authored by a user, a consumer (app), or both.
 * Prefer the human username when present; otherwise show the consumer name.
 */
export interface ChatMessageSenderFields {
	sender_username: string;
	sender_consumer_name: string;
}

/** Display name of the message author — username if present, otherwise consumer name. */
export function messageSenderName(message: ChatMessageSenderFields): string {
	return message.sender_username ? message.sender_username : message.sender_consumer_name;
}
