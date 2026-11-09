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
export { createChatRoomsPage, createChatRoomPage, createChatSettingsPage, createChatJoinPage, extractJoiningKey, DEFAULT_MAX_MESSAGE_LENGTH } from './pages.js';
export type { ChatObp, ChatPagesConfig, ChatRoomPageConfig } from './pages.js';
export { getChatConfig, chatPolicy, DEFAULT_LINK_HOSTS } from './policy.js';
export type { ChatConfig } from './policy.js';
export { findOrCreateDm } from './dm.js';
export { createChatStreamHandler } from './stream.js';
export type { ChatEventStream, ChatStreamConfig } from './stream.js';
export { createChatProxyHandler, chatProxyAllows } from './proxy.js';
