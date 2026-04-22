import { createClient, RedisClientType } from 'redis';
import { config } from '../../config';
import { logger } from '../../config/logger';
let client: RedisClientType | null = null;
let connectAttempted = false;
const getClient = (): RedisClientType => {
    if (!client) {
        client = createClient({ url: config.REDIS_URL }) as RedisClientType;
        client.on('error', (err) => logger.warn('Gateway Redis client error', { error: err.message }));
    }
    return client;
};
export const connectRedis = async (): Promise<void> => {
    if (connectAttempted) return;
    connectAttempted = true;
    try {
        await getClient().connect();
        logger.info('Gateway Redis connected');
    } catch (error: any) {
        logger.warn('Gateway Redis unavailable, continuing without cache', { error: error.message });
    }
};
export const closeRedis = async (): Promise<void> => {
    if (client?.isOpen) {
        await client.quit();
    }
};
export const getCachedJson = async <T>(key: string): Promise<T | null> => {
    try {
        if (!client?.isOpen) return null;
        const value = await client.get(key);
        return value ? JSON.parse(value) as T : null;
    } catch (error: any) {
        logger.warn('Gateway cache read failed', { key, error: error.message });
        return null;
    }
};
export const setCachedJson = async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
    try {
        if (!client?.isOpen) return;
        await client.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch (error: any) {
        logger.warn('Gateway cache write failed', { key, error: error.message });
    }
};
