import { Kafka, Consumer, logLevel } from 'kafkajs';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { AuditLogRepository } from '../database/AuditLogRepository';
let consumer: Consumer;
const repo = new AuditLogRepository();
const kafka = new Kafka({
    clientId: config.KAFKA_CLIENT_ID,
    brokers: config.KAFKA_BROKERS.split(','),
    logLevel: logLevel.WARN,
});
export const connectConsumer = async (): Promise<void> => {
    consumer = kafka.consumer({ groupId: config.KAFKA_GROUP_ID });
    await consumer.connect();
    logger.info(' Kafka consumer connected (Audit Service)');
    await consumer.subscribe({ topic: /^(?!__).*$/, fromBeginning: false });
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            try {
                const valueStr = message.value?.toString();
                if (!valueStr) return;
                const event = JSON.parse(valueStr);
                if (typeof event?.eventId !== 'string' || !event.eventId.trim()) {
                    logger.warn(`[Audit] Skipping message on ${topic} without a valid eventId`);
                    return;
                }
                const correlationId = message.headers?.['correlation-id']?.toString() || 'system';
                const inserted = await repo.recordEvent(
                    event.eventId,
                    event.eventType || topic,
                    event.aggregateId || 'unknown',
                    event.occurredAt || new Date().toISOString(),
                    event.payload || {},
                    correlationId
                );
                if (!inserted) {
                    logger.info(`[Audit] Skipping duplicate event ${event.eventId} on ${topic}`);
                    return;
                }
                logger.debug(`[Audit] Recorded ${event.eventType} on ${topic}`);
            } catch (err: any) {
                logger.error(`[Audit] Failed to record event on ${topic}`, { error: err.stack });
                throw err;
            }
        },
    });
};
export const disconnectConsumer = async (): Promise<void> => {
    if (consumer) {
        await consumer.disconnect();
        logger.info('Kafka consumer disconnected');
    }
};
