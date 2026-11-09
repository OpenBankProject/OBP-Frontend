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
import { createLogger } from '$shared/utils/logger';
import { collectLinkHosts } from '$shared/markdown/linkPolicy';
import { DEFAULT_MAX_MESSAGE_LENGTH, type ChatObp } from './pages';

const logger = createLogger('ChatConfig');

const CACHE_TTL_MS = 5 * 60 * 1000;

export interface ChatConfig {
	allowedLinkHosts: string[];
	maxMessageLength: number;
}

let cached: ChatConfig | null = null;
let cachedAt = 0;

/**
 * The chat policy published by the API (GET /obp/v7.0.0/public/chat-config) —
 * the same rules it enforces on message input (OBP-39015 link hosts,
 * OBP-39016 max length), so render-time filtering and the composer match it
 * exactly. Returns null when the config cannot be fetched (e.g. an older
 * API); callers then fall back to local configuration.
 */
export async function getChatConfig(obp: Pick<ChatObp, 'get'>): Promise<ChatConfig | null> {
	if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
		return cached;
	}
	try {
		const config = await obp.get('/obp/v7.0.0/public/chat-config');
		if (!Array.isArray(config?.allowed_link_hosts)) {
			logger.warn('chat-config response has no allowed_link_hosts array');
			return null;
		}
		cached = {
			allowedLinkHosts: config.allowed_link_hosts,
			maxMessageLength: typeof config.max_message_length === 'number' ? config.max_message_length : DEFAULT_MAX_MESSAGE_LENGTH
		};
		cachedAt = Date.now();
		return cached;
	} catch (error) {
		logger.warn('Could not fetch chat config, falling back to local chat policy:', error instanceof Error ? error.message : error);
		return null;
	}
}

// Hosts whose links stay clickable in rendered chat messages. The whitelist is
// authoritative from the API (GET /public/chat-config — the same list it
// enforces on message input); the app's fallback list only applies when the API
// doesn't publish one (older API). The deployment's own service hosts are always
// included. Everything else renders as inert text (anti-phishing) — see
// linkPolicy in @obp/shared.
export const DEFAULT_LINK_HOSTS = ['tesobe.com', 'openbankproject.com'];

/**
 * The link and length policy for a room page: the page's own host and the deployment's service URLs, plus OBP-API's
 * list (or the fallback when it publishes none), and the longest message allowed.
 */
export function chatPolicy(obp: Pick<ChatObp, 'get'>, serviceUrls: () => (string | undefined)[], fallbackHosts: () => string[] = () => DEFAULT_LINK_HOSTS) {
	return async (pageHost: string) => {
		const config = await getChatConfig(obp);
		return {
			hosts: collectLinkHosts([pageHost, ...serviceUrls(), ...(config?.allowedLinkHosts ?? fallbackHosts())]),
			maxMessageLength: config?.maxMessageLength ?? DEFAULT_MAX_MESSAGE_LENGTH
		};
	};
}
