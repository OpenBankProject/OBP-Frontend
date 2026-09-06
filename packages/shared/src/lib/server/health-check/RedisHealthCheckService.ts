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
import type Redis from 'ioredis';
import { type HealthCheckOptions, HealthCheckService } from '$shared/health-check/services/HealthCheckService';

const logger = createLogger('RedisHealthCheckService');

/** Anything that can hand out an ioredis client (each app has its own RedisService singleton). */
export interface RedisClientProvider {
    getClient(): Redis;
}

const PING_TIMEOUT_MS = 5000;

export class RedisHealthCheckService extends HealthCheckService {
    private redisProvider: RedisClientProvider;

    constructor(redisProvider: RedisClientProvider) {
        // We wont use the url, but HealthCheckService requires it
        super({ url: '', serviceName: 'Redis' } as HealthCheckOptions);
        this.redisProvider = redisProvider;
    }

    /**
     * Perform redis health check using the client
     */
    async performCheck(): Promise<void> {
        const startTime = performance.now();

        // ioredis queues commands while reconnecting, so an unguarded ping() can hang
        // indefinitely and leave the last snapshot frozen — time out and report unhealthy.
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        try {
            const redisClient = this.redisProvider.getClient();
            const pingResponse = await Promise.race([
                redisClient.ping(),
                new Promise<never>((_, reject) => {
                    timeoutId = setTimeout(
                        () => reject(new Error(`PING timed out after ${PING_TIMEOUT_MS} ms`)),
                        PING_TIMEOUT_MS
                    );
                })
            ]);

            const responseTimeMs = Math.round(performance.now() - startTime);

            if (pingResponse === 'PONG') {
                this.state.setSnapshot({
                    status: 'healthy',
                    responseTimeMs,
                });
                logger.debug(`Redis health check successful. Response time: ${responseTimeMs} ms`);
            } else {
                this.state.setSnapshot({
                    status: 'unhealthy',
                    responseTimeMs,
                    error: `Unexpected PING response: ${pingResponse}`,
                });
                logger.warn(`Redis health check unexpected response: ${pingResponse}`);
            }
        } catch (error) {
            const responseTimeMs = Math.round(performance.now() - startTime);
            this.state.setSnapshot({
                status: 'unhealthy',
                responseTimeMs,
                error: error instanceof Error ? error.message : String(error),
            });
            logger.error('Redis health check failed:', error);
        } finally {
            clearTimeout(timeoutId);
        }
    }

}
