import { config } from './config';
import { logger } from './config/logger';
import { createHttpServer } from './api/server';
const start = async () => {
    try {
        logger.info('Starting API Gateway Edge Service...');
        const app = createHttpServer();
        const server = app.listen(config.PORT, () => {
            logger.info(` API Gateway is listening on port ${config.PORT}`);
        });
        const gracefulShutdown = async (signal: string) => {
            logger.info(`\nReceived ${signal}. Graceful shutdown initiated...`);
            server.close(() => {
                logger.info('HTTP Gateway closed');
                process.exit(0);
            });
            setTimeout(() => process.exit(1), 5000);
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    } catch (err: any) {
        logger.error('Failed to start API Gateway', { error: err.stack });
        process.exit(1);
    }
};
start();
