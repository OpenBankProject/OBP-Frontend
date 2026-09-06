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
import type { RedisService } from '$shared/server/redis/RedisService';
import type { OBPRequests } from '$shared/obp/requests';

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
