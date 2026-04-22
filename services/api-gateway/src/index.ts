import { config } from './config';
import { logger } from './config/logger';
import { createHttpServer } from './api/server';
import { connectRedis, closeRedis } from './infrastructure/cache/redis.client';
const start = async () => {
    try {
        logger.info('Starting API Gateway Edge Service...');
        await connectRedis();
        const app = createHttpServer();
        const server = app.listen(config.PORT, () => {
            logger.info(` API Gateway is listening on port ${config.PORT}`);
        });
        const gracefulShutdown = async (signal: string) => {
            logger.info(`\nReceived ${signal}. Graceful shutdown initiated...`);
            const forceExitTimer = setTimeout(() => process.exit(1), 5000);
            await new Promise<void>((resolve) => {
                server.close(() => {
                    logger.info('HTTP Gateway closed');
                    resolve();
                });
            });
            await closeRedis();
            clearTimeout(forceExitTimer);
            process.exit(0);
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    } catch (err: any) {
        logger.error('Failed to start API Gateway', { error: err.stack });
        process.exit(1);
    }
};
start();
