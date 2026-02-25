import { Kafka, Producer, Partitioners, logLevel } from 'kafkajs';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { DomainEvent } from '../../domain/events/identity.events';
let producer: Producer;
const kafka = new Kafka({
    clientId: config.KAFKA_CLIENT_ID,
    brokers: config.KAFKA_BROKERS.split(','),
    logLevel: logLevel.WARN,
});
export const connectProducer = async (): Promise<void> => {
    producer = kafka.producer({
        createPartitioner: Partitioners.LegacyPartitioner,
        allowAutoTopicCreation: true,
    });
    await producer.connect();
    logger.info(' Kafka producer connected');
};
export const disconnectProducer = async (): Promise<void> => {
    if (producer) await producer.disconnect();
};
export const publishEvent = async <T extends DomainEvent>(topic: string, event: T): Promise<void> => {
    try {
        await producer.send({
            topic,
            messages: [
                {
                    key: event.aggregateId,
                    value: JSON.stringify(event),
                    headers: {
                        'correlation-id': event.correlationId ?? '',
                        'event-type': event.eventType,
                        'occurred-at': event.occurredAt,
                    },
                },
            ],
        });
        logger.debug('Kafka event published', { topic, eventType: event.eventType, aggregateId: event.aggregateId });
    } catch (err) {
        logger.error('Failed to publish Kafka event', { topic, event: event.eventType, error: err });
        throw err;
    }
};
