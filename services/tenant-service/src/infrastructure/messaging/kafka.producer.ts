import { Kafka, Producer, Partitioners, logLevel } from 'kafkajs';
import { config } from '../../config';
import { logger } from '../../config/logger';
let producer: Producer;
const kafka = new Kafka({
    clientId: config.KAFKA_CLIENT_ID,
    brokers: config.KAFKA_BROKERS.split(','),
    logLevel: logLevel.WARN,
});
export const connectProducer = async (): Promise<void> => {
    if (producer) return;
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
export const publishEvent = async (topic: string, key: string, payload: any): Promise<void> => {
    if (!producer) throw new Error('Producer not connected');
    await producer.send({
        topic,
        messages: [
            {
                key,
                value: JSON.stringify(payload),
                headers: {
                    'correlation-id': payload.correlationId ?? '',
                    'event-type': payload.eventType ?? 'unknown',
                },
            },
        ],
    });
};
