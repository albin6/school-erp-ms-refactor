import { config } from './config';
import { logger } from './config/logger';
import { createHttpServer } from './api/http/server';
import { connectDB, closeDB } from './infrastructure/database/db';
import { runMigrations } from './infrastructure/database/migrate';
import { connectConsumer, disconnectConsumer } from './infrastructure/messaging/kafka.consumer';
const start = async () => {
    try {
        logger.info('Starting Audit Service...');
        await connectDB();
        await runMigrations();
        const app = createHttpServer();
        const server = app.listen(config.HTTP_PORT, () => {
            logger.info(` HTTP health server listening on port ${config.HTTP_PORT}`);
        });
        logger.warn('Kafka consumer initialization is running in the background; audit event capture will stay degraded until the broker becomes reachable.');
        void connectConsumer();
        const gracefulShutdown = async (signal: string) => {
            logger.info(`\nReceived ${signal}. Graceful shutdown initiated...`);
            await disconnectConsumer();
            server.close();
            await closeDB();
            logger.info('Graceful shutdown complete. Exiting.');
            process.exit(0);
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    } catch (err: any) {
        logger.error('Failed to start Audit Service', { error: err.stack });
        process.exit(1);
    }
};
start();
