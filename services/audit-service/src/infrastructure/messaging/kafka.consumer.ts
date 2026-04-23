import { Kafka, Consumer, logLevel } from 'kafkajs';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { AuditLogRepository } from '../database/AuditLogRepository';
import { markKafkaConsumerConnected, markKafkaConsumerDisconnected, markKafkaMetadataVerified } from './kafka.readiness';
let consumer: Consumer;
const repo = new AuditLogRepository();
const kafka = new Kafka({
    clientId: config.KAFKA_CLIENT_ID,
    brokers: config.KAFKA_BROKERS.split(','),
    logLevel: logLevel.WARN,
});
const refreshKafkaReadiness = async (reason: string): Promise<void> => {
    const admin = kafka.admin();
    try {
        await admin.connect();
        await admin.fetchTopicMetadata();
        markKafkaMetadataVerified();
        logger.info(` Kafka readiness verified via metadata fetch (${reason})`);
    } catch (err: any) {
        logger.warn(`Kafka readiness metadata fetch failed (${reason})`, { error: err.message });
    } finally {
        try {
            await admin.disconnect();
        } catch {
            // Ignore admin disconnect cleanup failures.
        }
    }
};
export const connectConsumer = async (): Promise<void> => {
    consumer = kafka.consumer({ groupId: config.KAFKA_GROUP_ID });
    consumer.on(consumer.events.CONNECT, () => {
        markKafkaConsumerConnected();
        void refreshKafkaReadiness('connect');
    });
    consumer.on(consumer.events.GROUP_JOIN, () => {
        markKafkaConsumerConnected();
        markKafkaMetadataVerified();
        logger.info(' Kafka consumer group joined (Audit Service)');
    });
    consumer.on(consumer.events.DISCONNECT, () => {
        markKafkaConsumerDisconnected('Kafka consumer disconnected');
        logger.warn('Kafka consumer disconnected; readiness downgraded');
    });
    consumer.on(consumer.events.CRASH, (event) => {
        const errorMessage = event.payload.error instanceof Error ? event.payload.error.message : 'Unknown Kafka consumer crash';
        markKafkaConsumerDisconnected(errorMessage);
        logger.warn('Kafka consumer crashed; readiness downgraded', { error: errorMessage });
    });
    await consumer.connect();
    markKafkaConsumerConnected();
    logger.info(' Kafka consumer connected (Audit Service)');
    await consumer.subscribe({ topic: /^(?!__).*$/, fromBeginning: false });
    void refreshKafkaReadiness('post-subscribe');
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
        markKafkaConsumerDisconnected('Kafka consumer disconnected');
        logger.info('Kafka consumer disconnected');
    }
};
