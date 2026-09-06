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
import Redis, { type RedisOptions } from 'ioredis';

const logger = createLogger('RedisService');

export interface RedisConfig {
    host?: string;
    port?: number;
    password?: string;
}

export class RedisService {
    private client: InstanceType<typeof Redis>;

    constructor(config: RedisConfig = {}) {
        this.client = this.initRedisClient(config);
    }

    private initRedisClient(config: RedisConfig): InstanceType<typeof Redis> {
        if (!config.host || !config.port) {
            logger.warn('Redis host or port is not set. Using defaults.');
            return new Redis({
                host: 'localhost',
                port: 6379
            });
        } else {
            logger.debug('Connecting to Redis at:', config.host, config.port);
            logger.debug('Redis password provided:', !!config.password);

            const redisConfig: RedisOptions = {
                host: config.host,
                port: config.port
            };

            if (config.password) {
                redisConfig.password = config.password;
            }

            return new Redis(redisConfig);
        }
    }

    /**
   * Get the Redis client instance
   */
    getClient(): InstanceType<typeof Redis> {
        return this.client;
    }
}

export function createRedisService(config: RedisConfig = {}): RedisService {
    return new RedisService(config);
}
