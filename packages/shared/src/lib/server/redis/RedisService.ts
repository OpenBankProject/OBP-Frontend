import { createLogger } from '$lib/utils/logger';
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
