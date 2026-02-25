import { sequelize } from "../../../infrastructure/database/sequelize";
import redisClient from "../../../infrastructure/redis/redis.client";
export const checkHealth = async () => {
    const dbStatus = await sequelize.authenticate().then(() => 'connected').catch(() => 'disconnected');
    const redisStatus = redisClient.isOpen ? 'connected' : 'disconnected';
    return {
        server: 'running',
        database: dbStatus,
        redis: redisStatus,
        timestamp: new Date().toISOString()
    };
};
