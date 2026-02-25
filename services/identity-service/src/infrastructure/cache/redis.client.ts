import { createClient, RedisClientType } from 'redis';
import { config } from '../../config';
import { logger } from '../../config/logger';
let client: RedisClientType;
export const getRedis = (): RedisClientType => {
    if (!client) {
        client = createClient({ url: config.REDIS_URL }) as RedisClientType;
        client.on('error', (err) => logger.error('Redis client error', { error: err.message }));
        client.on('reconnecting', () => logger.warn('Redis reconnecting...'));
    }
    return client;
};
export const connectRedis = async (): Promise<void> => {
    await getRedis().connect();
    logger.info(' Redis connected');
};
export const closeRedis = async (): Promise<void> => {
    if (client) await client.quit();
};
export const blacklistToken = async (token: string, ttlSeconds: number): Promise<void> => {
    await getRedis().setEx(`blacklist:${token}`, ttlSeconds, '1');
};
export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
    const result = await getRedis().get(`blacklist:${token}`);
    return result !== null;
};
