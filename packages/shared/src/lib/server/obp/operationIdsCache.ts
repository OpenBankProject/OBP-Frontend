import { createLogger } from '$lib/utils/logger';
import type { RedisService } from '$lib/server/redis/RedisService';
import type { OBPRequests } from '$lib/obp/requests';

const logger = createLogger('OperationIdsCache');

const CACHE_KEY = 'obp-portal:operation-ids';
const CACHE_TTL_SECONDS = 3600; // 1 hour

export interface OperationIdEntry {
	operation_id: string;
	summary: string;
}

export async function getOperationIds(
	redisService: RedisService,
	obpRequests: OBPRequests,
	apiVersion: string,
	token?: string
): Promise<OperationIdEntry[]> {
	const redis = redisService.getClient();
	const cacheKey = `${CACHE_KEY}:${apiVersion}`;

	// Try to get from cache first
	try {
		const cached = await redis.get(cacheKey);
		if (cached) {
			logger.debug('Operation IDs cache hit');
			return JSON.parse(cached);
		}
	} catch (e) {
		logger.warn('Failed to read from cache:', e);
	}

	// Cache miss - fetch from API
	logger.debug('Operation IDs cache miss, fetching from API');
	let operations: OperationIdEntry[] = [];

	try {
		const docsResponse = await obpRequests.get(
			`/obp/${apiVersion}/resource-docs/${apiVersion}/obp`,
			token
		);

		if (docsResponse?.resource_docs) {
			operations = docsResponse.resource_docs.map((doc: any) => ({
				operation_id: doc.operation_id,
				summary: doc.summary || ''
			}));

			// Store in cache
			try {
				await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(operations));
				logger.debug(`Cached ${operations.length} operation IDs for ${CACHE_TTL_SECONDS}s`);
			} catch (e) {
				logger.warn('Failed to write to cache:', e);
			}
		}
	} catch (e) {
		logger.error('Failed to fetch resource docs:', e);
	}

	return operations;
}
