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
import { createLogger } from '@obp/shared/utils';
import Redis from 'ioredis';
import { env } from '$env/dynamic/private';

const logger = createLogger('RedisService');

class RedisService {
    private client: Redis;

    constructor() {
        this.client = this.initRedisClient();
    }

    private initRedisClient(): Redis {
        if (!env.REDIS_HOST || !env.REDIS_PORT) {
            logger.warn('Redis host or port is not set. Using defaults.');
            return new Redis({
                host: 'localhost',
                port: 6379
            });
        } else {
            logger.debug('Connecting to Redis at:', env.REDIS_HOST, env.REDIS_PORT);
            logger.debug('Redis password provided:', !!env.REDIS_PASSWORD);

            const redisConfig: any = {
                host: env.REDIS_HOST,
                port: parseInt(env.REDIS_PORT)
            };

            if (env.REDIS_PASSWORD) {
                redisConfig.password = env.REDIS_PASSWORD;
            }

            return new Redis(redisConfig);
        }
    }

    /**
   * Get the Redis client instance
   */
    getClient(): Redis {
        return this.client;
    }
}

export const redisService = new RedisService();