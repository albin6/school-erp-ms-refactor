import { Kafka, Consumer, logLevel } from 'kafkajs';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { processTenantCreatedEvent, processIdentityUserCreatedEvent } from '../../application/use-cases/eventHandlers';
import { markKafkaConsumerConnected, markKafkaConsumerDisconnected, markKafkaMetadataVerified } from './kafka.readiness';
let consumer: Consumer;
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
        logger.info(' Kafka consumer group joined');
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
    logger.info(' Kafka consumer connected');
    await consumer.subscribe({ topic: 'tenant.created', fromBeginning: false });
    await consumer.subscribe({ topic: 'identity.user.created', fromBeginning: false });
    void refreshKafkaReadiness('post-subscribe');
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            logger.debug(`Received message on ${topic} [partition ${partition}]`);
            try {
                const valueStr = message.value?.toString();
                if (!valueStr) return;
                const event = JSON.parse(valueStr);
                if (typeof event?.eventId !== 'string' || !event.eventId.trim()) {
                    logger.warn(`Skipping message on ${topic} without a valid eventId`);
                    return;
                }
                switch (topic) {
                    case 'tenant.created':
                        await processTenantCreatedEvent(event);
                        break;
                    case 'identity.user.created':
                        await processIdentityUserCreatedEvent(event);
                        break;
                    default:
                        logger.warn(`No handler assigned for topic ${topic}`);
                }
            } catch (err: any) {
                logger.error(`Error processing Kafka message on topic ${topic}`, { error: err.stack });
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
