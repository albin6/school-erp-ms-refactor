import { Kafka, Consumer, Producer, Partitioners, logLevel } from 'kafkajs';
import { z } from 'zod';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { AuditLogRepository } from '../database/AuditLogRepository';
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

const repo = new AuditLogRepository();
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
        logger.info(' Kafka consumer group joined (Audit Service)');
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

const getRetryDelayMs = (attempt: number): number =>
    Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.max(1, attempt));

const getNextOffset = (offset: string): string => (BigInt(offset) + 1n).toString();
const eventEnvelopeSchema = z.object({
    eventId: z.string().min(1),
    eventType: z.string().min(1).optional(),
    aggregateId: z.string().min(1).optional(),
    occurredAt: z.string().datetime().optional(),
    payload: z.record(z.any()).default({}),
});

const scheduleReconnect = (reason: string, error?: string) => {
    if (shutdownRequested || retryTimer || connectPromise || consumer) return;

    const nextAttempt = retryAttempt + 1;
    const delayMs = getRetryDelayMs(nextAttempt);

    logger.warn(`Kafka consumer unavailable; audit event capture is degraded. Retrying in ${delayMs}ms`, {
        attempt: nextAttempt,
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
            logger.info(' Kafka consumer connected (Audit Service)');

            await nextConsumer.subscribe({ topic: /^(?!__).*$/, fromBeginning: false });
            void refreshKafkaReadiness('post-subscribe');

            await nextConsumer.run({
                autoCommit: false,
                eachMessage: async ({ topic, partition, message }) => {
                    try {
                        const valueStr = message.value?.toString();
                        const nextOffset = getNextOffset(message.offset);
                        if (!valueStr) {
                            logger.warn(`[Audit] Skipping empty message on ${topic}`);
                            await nextConsumer.commitOffsets([{ topic, partition, offset: nextOffset }]);
                            return;
                        }
                        let parsed: unknown;
                        try {
                            parsed = JSON.parse(valueStr);
                        } catch (parseError: any) {
                            logger.warn(`[Audit] Skipping invalid JSON message on ${topic}`, {
                                partition,
                                offset: message.offset,
                                error: parseError.message,
                            });
                            await eventRepo.recordFailure({
                                topic,
                                payload: { raw: valueStr },
                                errorMessage: parseError.message,
                            });
                            await publishDlq(topic, { raw: valueStr }, parseError);
                            await nextConsumer.commitOffsets([{ topic, partition, offset: nextOffset }]);
                            return;
                        }

                        const eventResult = eventEnvelopeSchema.safeParse(parsed);
                        if (!eventResult.success) {
                            logger.warn(`[Audit] Skipping invalid event envelope on ${topic}`, {
                                partition,
                                offset: message.offset,
                                issues: eventResult.error.issues,
                            });
                            await eventRepo.recordFailure({
                                eventId: typeof (parsed as any)?.eventId === 'string' ? (parsed as any).eventId : undefined,
                                eventType: typeof (parsed as any)?.eventType === 'string' ? (parsed as any).eventType : topic,
                                topic,
                                payload: parsed,
                                errorMessage: eventResult.error.message,
                            });
                            await publishDlq(topic, parsed, eventResult.error);
                            await nextConsumer.commitOffsets([{ topic, partition, offset: nextOffset }]);
                            return;
                        }

                        const event = eventResult.data;
                        const eventType = event.eventType ?? topic;
                        if (await eventRepo.hasProcessed(event.eventId)) {
                            logger.info(`[Audit] Skipping duplicate processed event ${event.eventId} on ${topic}`);
                            await nextConsumer.commitOffsets([{ topic, partition, offset: nextOffset }]);
                            return;
                        }
                        const correlationId = message.headers?.['correlation-id']?.toString() || 'system';
                        const inserted = await repo.recordEvent(
                            event.eventId,
                            eventType,
                            event.aggregateId ?? 'unknown',
                            event.occurredAt ?? new Date().toISOString(),
                            event.payload,
                            correlationId
                        );
                        if (!inserted) {
                            logger.info(`[Audit] Skipping duplicate event ${event.eventId} on ${topic}`);
                            await eventRepo.markProcessed(event.eventId, eventType);
                            await nextConsumer.commitOffsets([{ topic, partition, offset: nextOffset }]);
                            return;
                        }

                        await eventRepo.markProcessed(event.eventId, eventType);
                        await nextConsumer.commitOffsets([{ topic, partition, offset: nextOffset }]);
                        logger.debug(`[Audit] Recorded ${event.eventType} on ${topic}`);
                    } catch (err: any) {
                        logger.error(`[Audit] Failed to record event on ${topic}`, {
                            partition,
                            offset: message.offset,
                            error: err.stack,
                        });
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
            logger.warn('Kafka consumer connection attempt failed; audit event capture remains degraded', {
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
