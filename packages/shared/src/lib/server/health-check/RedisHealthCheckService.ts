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
