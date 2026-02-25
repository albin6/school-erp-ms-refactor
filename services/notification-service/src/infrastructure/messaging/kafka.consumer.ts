import { Kafka, Consumer, logLevel } from 'kafkajs';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { processTenantCreatedEvent, processIdentityUserCreatedEvent } from '../../application/use-cases/eventHandlers';
let consumer: Consumer;
const kafka = new Kafka({
    clientId: config.KAFKA_CLIENT_ID,
    brokers: config.KAFKA_BROKERS.split(','),
    logLevel: logLevel.WARN,
});
export const connectConsumer = async (): Promise<void> => {
    consumer = kafka.consumer({ groupId: config.KAFKA_GROUP_ID });
    await consumer.connect();
    logger.info(' Kafka consumer connected');
    await consumer.subscribe({ topic: 'tenant.created', fromBeginning: false });
    await consumer.subscribe({ topic: 'identity.user.created', fromBeginning: false });
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            logger.debug(`Received message on ${topic} [partition ${partition}]`);
            try {
                const valueStr = message.value?.toString();
                if (!valueStr) return;
                const event = JSON.parse(valueStr);
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
        logger.info('Kafka consumer disconnected');
    }
};
