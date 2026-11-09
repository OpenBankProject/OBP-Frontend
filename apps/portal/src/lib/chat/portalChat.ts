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
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { chatPolicy, DEFAULT_LINK_HOSTS, type ChatPagesConfig } from '@obp/shared/server/chat';
import { obp_requests } from '$lib/obp/requests';

/** The Portal's chat: the system-wide rooms, at /user/chat. The pages themselves are in @obp/shared/server/chat. */
export const PORTAL_CHAT: ChatPagesConfig = { scope: { kind: 'system' }, obp: obp_requests, basePath: '/user/chat' };

/**
 * The links that stay clickable in messages: the Portal's own services, and OBP-API's list; when the API publishes
 * none (older API), PUBLIC_CHAT_LINK_ALLOWED_HOSTS or the built-in default (tesobe.com, openbankproject.com).
 */
export const portalChatPolicy = chatPolicy(
	obp_requests,
	() => [
		publicEnv.PUBLIC_OBP_BASE_URL,
		publicEnv.PUBLIC_OPEY_BASE_URL,
		publicEnv.PUBLIC_SUBSCRIPTIONS_URL,
		env.API_EXPLORER_URL,
		env.API_MANAGER_URL,
		env.SANDBOX_POPULATOR_URL
	],
	() => (publicEnv.PUBLIC_CHAT_LINK_ALLOWED_HOSTS !== undefined ? publicEnv.PUBLIC_CHAT_LINK_ALLOWED_HOSTS.split(',') : DEFAULT_LINK_HOSTS)
);
