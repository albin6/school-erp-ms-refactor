import { config } from './config';
import { logger } from './config/logger';
import { createHttpServer } from './api/server';
import { connectRedis, closeRedis } from './infrastructure/cache/redis.client';
import { verifyIdentityGrpcConnectivity } from './infrastructure/grpc/identity.client';
import { verifyTenantGrpcConnectivity } from './infrastructure/grpc/tenant.client';
const start = async () => {
    try {
        logger.info('Starting API Gateway Edge Service...');
        if (config.INTERNAL_AUTH_SECRET) {
            logger.info('INTERNAL_AUTH_SECRET configured; gateway will forward trusted internal auth headers. Tenant-service must use the same value.');
        } else {
            logger.warn('INTERNAL_AUTH_SECRET is not configured; falling back to downstream gRPC token validation. This is safe, but the gateway/tenant-service auth shortcut is disabled.');
        }
        await connectRedis();
        const app = createHttpServer();
        const server = app.listen(config.PORT, () => {
            logger.info(` API Gateway is listening on port ${config.PORT}`);
        });
        void Promise.allSettled([
            verifyIdentityGrpcConnectivity(),
            verifyTenantGrpcConnectivity(),
        ]).then((results) => {
            const [identityResult, tenantResult] = results;
            if (identityResult.status === 'fulfilled') {
                logger.info('Identity gRPC connectivity check succeeded');
            } else {
                logger.warn('Identity gRPC connectivity check failed; gateway startup continues', {
                    error: identityResult.reason instanceof Error ? identityResult.reason.message : String(identityResult.reason),
                });
            }
            if (tenantResult.status === 'fulfilled') {
                logger.info('Tenant gRPC connectivity check succeeded');
            } else {
                logger.warn('Tenant gRPC connectivity check failed; gateway startup continues', {
                    error: tenantResult.reason instanceof Error ? tenantResult.reason.message : String(tenantResult.reason),
                });
            }
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
