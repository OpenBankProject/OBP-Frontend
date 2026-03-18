import { createLogger } from '$lib/utils/logger';
import type { RedisService } from '$lib/server/redis/RedisService';
import { type HealthCheckOptions, HealthCheckService } from '$lib/health-check/services/HealthCheckService';

const logger = createLogger('RedisHealthCheckService');

export class RedisHealthCheckService extends HealthCheckService {
    private redisService: RedisService;

    constructor(redisService: RedisService) {
        // We wont use the url, but HealthCheckService requires them
        super({ url: '', serviceName: 'Redis' } as HealthCheckOptions);
        this.redisService = redisService;
        this.state.setSnapshot({
            service: 'Redis',
            status: 'unknown',
        })
    }

    /**
     * Perform redis health check using the client
     */
    async performCheck(): Promise<void> {
        const startTime = performance.now();

        try {
            const redisClient = this.redisService.getClient();
            const pingResponse = await redisClient.ping();

            const responseTimeMs = performance.now() - startTime;

            if (pingResponse === 'PONG') {
                this.state.setSnapshot({
                    status: 'healthy',
                    responseTimeMs,
                });
                logger.debug(`Redis health check successful. Response time: ${responseTimeMs.toFixed(2)} ms`);
            } else {
                this.state.setSnapshot({
                    status: 'unhealthy',
                    responseTimeMs,
                    error: `Unexpected PING response: ${pingResponse}`,
                });
                logger.warn(`Redis health check unexpected response: ${pingResponse}`);
            }
        } catch (error) {
            const responseTimeMs = performance.now() - startTime;
            this.state.setSnapshot({
                status: 'unhealthy',
                responseTimeMs,
                error: error instanceof Error ? error.message : String(error),
            });
            logger.error('Redis health check failed:', error);
        }
    }

}
