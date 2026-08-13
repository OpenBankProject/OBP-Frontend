import { createLogger } from '@obp/shared/utils';
import { obp_requests } from '$lib/obp/requests';

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
export async function getChatConfig(): Promise<ChatConfig | null> {
	if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
		return cached;
	}
	try {
		const config = await obp_requests.get('/obp/v7.0.0/public/chat-config');
		if (!Array.isArray(config?.allowed_link_hosts)) {
			logger.warn('chat-config response has no allowed_link_hosts array');
			return null;
		}
		cached = {
			allowedLinkHosts: config.allowed_link_hosts,
			maxMessageLength:
				typeof config.max_message_length === 'number' ? config.max_message_length : 10000
		};
		cachedAt = Date.now();
		return cached;
	} catch (error) {
		logger.warn(
			'Could not fetch chat config, falling back to local chat policy:',
			error instanceof Error ? error.message : error
		);
		return null;
	}
}
