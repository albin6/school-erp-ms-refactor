import { config } from './config';
import { logger } from './config/logger';
import { createHttpServer } from './api/http/server';
import { connectDB, closeDB } from './infrastructure/database/db';
import { runMigrations } from './infrastructure/database/migrate';
import { connectProducer, disconnectProducer } from './infrastructure/messaging/kafka.producer';
import { startOutboxWorker, stopOutboxWorker } from './infrastructure/messaging/outbox.worker';

const start = async () => {
    try {
        logger.info('Starting Academic Service...');
        logger.info('INTERNAL_AUTH_SIGNING_SECRET configured; academic-service will verify signed gateway auth tokens.');
        await connectDB();
        await runMigrations();
        logger.warn('Kafka producer initialization is running in the background; academic event publishing will stay degraded until the broker becomes reachable.');
        void connectProducer();

        const app = createHttpServer();
        const server = app.listen(config.HTTP_PORT, () => {
            logger.info(` HTTP REST server listening on port ${config.HTTP_PORT}`);
        });
        startOutboxWorker();

        const gracefulShutdown = async (signal: string) => {
            logger.info(`\nReceived ${signal}. Graceful shutdown initiated...`);
            stopOutboxWorker();
            server.close(() => logger.info('HTTP server closed'));
            await disconnectProducer();
            await closeDB();
            logger.info('Graceful shutdown complete. Exiting.');
            process.exit(0);
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    } catch (error: any) {
        logger.error('Failed to start Academic Service', { error: error.stack });
        process.exit(1);
    }
};

start();
