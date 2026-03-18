import { createLogger } from '../../utils/logger';
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