import { createLogger } from '$lib/utils/logger';
import { redisService } from '$lib/redis/services/RedisService';
import { HealthCheckState } from '../state/HealthCheckState';
import { type HealthCheckOptions, HealthCheckService } from './HealthCheckService';

const logger = createLogger('RedisHealthCheckService');

export class RedisHealthCheckService extends HealthCheckService {
    constructor() {
        // We wont use the url, but HealthCheckService requires them
        super({ url: '', serviceName: 'Redis' } as HealthCheckOptions);
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
            const redisClient = redisService.getClient();
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