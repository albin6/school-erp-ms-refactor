import { Kafka, Consumer, Producer, Partitioners, logLevel } from 'kafkajs';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { processTenantCreatedEvent, processIdentityUserCreatedEvent } from '../../application/use-cases/eventHandlers';
import { markKafkaConsumerConnected, markKafkaConsumerDisconnected, markKafkaMetadataVerified } from './kafka.readiness';
import { EventProcessingRepository } from '../database/EventProcessingRepository';
let consumer: Consumer | null = null;
let dlqProducer: Producer | null = null;
let connectPromise: Promise<void> | null = null;
let retryTimer: NodeJS.Timeout | null = null;
let retryAttempt = 0;
let shutdownRequested = false;

const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 30000;
const RETRY_JITTER_RATIO = 0.2;
const eventRepo = new EventProcessingRepository();

const kafka = new Kafka({
    clientId: config.KAFKA_CLIENT_ID,
    brokers: config.KAFKA_BROKERS.split(','),
    logLevel: logLevel.WARN,
});
const getDlqProducer = async (): Promise<Producer> => {
    if (!dlqProducer) {
        dlqProducer = kafka.producer({
            createPartitioner: Partitioners.LegacyPartitioner,
            allowAutoTopicCreation: true,
        });
        await dlqProducer.connect();
    }
    return dlqProducer;
};

const publishDlq = async (topic: string, event: any, error: unknown): Promise<void> => {
    const producer = await getDlqProducer();
    const errorMessage = error instanceof Error ? error.message : String(error);
    await producer.send({
        topic: `${topic}.dlq`,
        messages: [{
            key: event?.aggregateId ?? event?.eventId ?? topic,
            value: JSON.stringify({
                ...event,
                dlq: {
                    sourceTopic: topic,
                    errorMessage,
                    failedAt: new Date().toISOString(),
                },
            }),
        }],
    });
};
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

const createConsumer = (): Consumer => {
    const nextConsumer = kafka.consumer({ groupId: config.KAFKA_GROUP_ID });

    nextConsumer.on(nextConsumer.events.CONNECT, () => {
        markKafkaConsumerConnected();
        void refreshKafkaReadiness('connect');
    });

    nextConsumer.on(nextConsumer.events.GROUP_JOIN, () => {
        markKafkaConsumerConnected();
        markKafkaMetadataVerified();
        logger.info(' Kafka consumer group joined');
    });

    nextConsumer.on(nextConsumer.events.DISCONNECT, () => {
        markKafkaConsumerDisconnected('Kafka consumer disconnected');
        logger.warn('Kafka consumer disconnected; readiness downgraded');
    });

    nextConsumer.on(nextConsumer.events.CRASH, (event) => {
        const errorMessage = event.payload.error instanceof Error ? event.payload.error.message : 'Unknown Kafka consumer crash';
        markKafkaConsumerDisconnected(errorMessage);
        logger.warn('Kafka consumer crashed; readiness downgraded', { error: errorMessage });

        if (!event.payload.restart) {
            consumer = null;
            scheduleReconnect('consumer-crash', errorMessage);
        }
    });

    return nextConsumer;
};

const getRetryDelayMs = (attempt: number): number => {
    const exponentialDelayMs = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(2, Math.max(0, attempt - 1)));
    const jitterWindowMs = Math.floor(exponentialDelayMs * RETRY_JITTER_RATIO);

    if (jitterWindowMs <= 0) {
        return exponentialDelayMs;
    }

    const jitterOffsetMs = Math.floor(Math.random() * (jitterWindowMs * 2 + 1)) - jitterWindowMs;
    return Math.max(RETRY_BASE_MS, Math.min(RETRY_MAX_MS, exponentialDelayMs + jitterOffsetMs));
};

const scheduleReconnect = (reason: string, error?: string) => {
    if (shutdownRequested || retryTimer || connectPromise || consumer) return;

    const nextAttempt = retryAttempt + 1;
    const delayMs = getRetryDelayMs(nextAttempt);

    logger.warn(`Kafka consumer unavailable; notification delivery is degraded. Retrying in ${delayMs}ms`, {
        attempt: nextAttempt,
        baseDelayMs: RETRY_BASE_MS,
        maxDelayMs: RETRY_MAX_MS,
        reason,
        error,
    });

    retryTimer = setTimeout(() => {
        retryTimer = null;
        retryAttempt = nextAttempt;
        void connectConsumer('retry');
    }, delayMs);
};

export const connectConsumer = async (reason = 'startup'): Promise<void> => {
    if (shutdownRequested || consumer || connectPromise) return;

    const nextConsumer = createConsumer();
    consumer = nextConsumer;

    connectPromise = (async () => {
        try {
            await nextConsumer.connect();

            if (shutdownRequested) {
                await nextConsumer.disconnect();
                return;
            }

            markKafkaConsumerConnected();
            logger.info(' Kafka consumer connected');

            await nextConsumer.subscribe({ topic: 'tenant.created', fromBeginning: false });
            await nextConsumer.subscribe({ topic: 'identity.user.created', fromBeginning: false });
            void refreshKafkaReadiness('post-subscribe');

            await nextConsumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    logger.debug(`Received message on ${topic} [partition ${partition}]`);
                    try {
                        const valueStr = message.value?.toString();
                        if (!valueStr) return;
                        const event = JSON.parse(valueStr);
                        if (typeof event?.eventId !== 'string' || !event.eventId.trim()) {
                            logger.warn(`Skipping message on ${topic} without a valid eventId`);
                            await eventRepo.recordFailure({
                                topic,
                                payload: event,
                                errorMessage: 'Missing valid eventId',
                            });
                            await publishDlq(topic, event, new Error('Missing valid eventId'));
                            return;
                        }
                        const eventType = event.eventType ?? topic;
                        if (await eventRepo.hasProcessed(event.eventId)) {
                            logger.info(`Skipping duplicate event ${event.eventId} on ${topic}`);
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
                        await eventRepo.markProcessed(event.eventId, eventType);
                    } catch (err: any) {
                        logger.error(`Error processing Kafka message on topic ${topic}`, { error: err.stack });
                        let parsedEvent: any = {};
                        try {
                            parsedEvent = message.value ? JSON.parse(message.value.toString()) : {};
                        } catch {
                            parsedEvent = {};
                        }
                        await eventRepo.recordFailure({
                            eventId: parsedEvent?.eventId,
                            eventType: parsedEvent?.eventType ?? topic,
                            topic,
                            payload: parsedEvent,
                            errorMessage: err instanceof Error ? err.message : String(err),
                        });
                        await publishDlq(topic, parsedEvent, err);
                        throw err;
                    }
                },
            });

            retryAttempt = 0;
        } catch (err: any) {
            const errorMessage = err instanceof Error ? err.message : String(err);

            if (consumer === nextConsumer) {
                consumer = null;
            }

            markKafkaConsumerDisconnected(errorMessage);
            logger.warn('Kafka consumer connection attempt failed; notification delivery remains degraded', {
                reason,
                error: errorMessage,
            });

            try {
                await nextConsumer.disconnect();
            } catch {
                // Ignore cleanup failures for a consumer that never connected cleanly.
            }

            scheduleReconnect(reason, errorMessage);
        } finally {
            connectPromise = null;
        }
    })();

    await connectPromise;
};

export const disconnectConsumer = async (): Promise<void> => {
    shutdownRequested = true;

    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }

    if (consumer) {
        const currentConsumer = consumer;
        consumer = null;
        await currentConsumer.disconnect();
        markKafkaConsumerDisconnected('Kafka consumer disconnected');
        logger.info('Kafka consumer disconnected');
    }
    if (dlqProducer) {
        await dlqProducer.disconnect();
        dlqProducer = null;
    }
};
