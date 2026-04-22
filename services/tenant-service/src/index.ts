import * as grpc from '@grpc/grpc-js';
import { config } from './config';
import { logger } from './config/logger';
import { createHttpServer } from './api/http/server';
import { createGrpcServer } from './api/grpc/server';
import { connectDB, closeDB } from './infrastructure/database/db';
import { runMigrations } from './infrastructure/database/migrate';
import { connectProducer, disconnectProducer } from './infrastructure/messaging/kafka.producer';
import { startOutboxWorker, stopOutboxWorker } from './infrastructure/messaging/outbox.worker';
const start = async () => {
    try {
        logger.info('Starting Tenant Service...');
        if (config.INTERNAL_AUTH_SECRET) {
            logger.info('INTERNAL_AUTH_SECRET configured; tenant-service will trust gateway-provided auth headers when the secret matches.');
        } else {
            logger.warn('INTERNAL_AUTH_SECRET is not configured; falling back to Identity Service gRPC token validation for every authenticated request.');
        }
        await connectDB();
        await runMigrations();
        await connectProducer();
        const app = createHttpServer();
        const server = app.listen(config.HTTP_PORT, () => {
            logger.info(` HTTP REST server listening on port ${config.HTTP_PORT}`);
        });
        const grpcServer = createGrpcServer();
        grpcServer.bindAsync(
            `0.0.0.0:${config.GRPC_PORT}`,
            grpc.ServerCredentials.createInsecure(),
            (error, port) => {
                if (error) {
                    logger.error('Failed to bind gRPC server', { error });
                    process.exit(1);
                }
                logger.info(` gRPC server listening on port ${port}`);
            }
        );
        startOutboxWorker();
        const gracefulShutdown = async (signal: string) => {
            logger.info(`\nReceived ${signal}. Graceful shutdown initiated...`);
            stopOutboxWorker();
            server.close(() => logger.info('HTTP server closed'));
            grpcServer.forceShutdown();
            await disconnectProducer();
            await closeDB();
            logger.info('Graceful shutdown complete. Exiting.');
            process.exit(0);
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    } catch (err: any) {
        logger.error('Failed to start Tenant Service', { error: err.stack });
        process.exit(1);
    }
};
start();
