import { Kafka, Consumer, Producer, Partitioners, logLevel } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { createUserUseCase } from '../../application/use-cases/createUser.usecase';
import { withTransaction } from '../database/db';
import { insertOutboxEvent } from '../database/outbox.repository';
import { EventProcessingRepository } from '../database/EventProcessingRepository';

let consumer: Consumer | null = null;
let dlqProducer: Producer | null = null;
let connectPromise: Promise<void> | null = null;
let retryTimer: NodeJS.Timeout | null = null;
let retryAttempt = 0;
let shutdownRequested = false;

const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 30000;
const eventRepo = new EventProcessingRepository();

const kafka = new Kafka({
    clientId: `${config.KAFKA_CLIENT_ID}-tenant-provisioning`,
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

const getRetryDelayMs = (attempt: number): number =>
    Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.max(1, attempt));

const scheduleReconnect = (reason: string, error?: string) => {
    if (shutdownRequested || retryTimer || connectPromise || consumer) return;

    const nextAttempt = retryAttempt + 1;
    const delayMs = getRetryDelayMs(nextAttempt);

    logger.warn(`Kafka consumer unavailable; tenant provisioning is degraded. Retrying in ${delayMs}ms`, {
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

const processTenantProvisioningRequested = async (event: any): Promise<void> => {
    const payload = event?.payload ?? {};
    if (typeof event?.eventId !== 'string' || !event.eventId.trim()) {
        throw new Error('Missing valid eventId');
    }
    if (await eventRepo.hasProcessed(event.eventId)) {
        logger.info('Skipping duplicate tenant provisioning event', { eventId: event.eventId });
        return;
    }
    const tenantId = payload.tenantId;
    const adminEmail = payload.adminEmail;
    const tenantName = payload.name;
    const idempotencyKey = payload.idempotencyKey ?? `tenant-admin:${tenantId}:${String(adminEmail).toLowerCase().trim()}`;

    if (!tenantId || !adminEmail || !tenantName) {
        logger.warn('Skipping tenant provisioning event with missing fields', {
            eventId: event?.eventId,
            eventType: event?.eventType,
        });
        return;
    }

    const adminUser = await createUserUseCase({
        email: adminEmail,
        name: `${tenantName} Admin`,
        idempotencyKey,
        mustResetPassword: true,
        correlationId: event?.correlationId,
    });

    await withTransaction(async (client) => {
        await insertOutboxEvent(
            client,
            {
                eventId: uuidv4(),
                eventType: 'identity.tenant_admin.created',
                aggregateId: adminUser.userId,
                occurredAt: new Date().toISOString(),
                correlationId: event?.correlationId,
                payload: {
                    tenantId,
                    userId: adminUser.userId,
                    email: adminEmail,
                    name: `${tenantName} Admin`,
                    alreadyExisted: adminUser.alreadyExisted,
                },
            },
            'User'
        );
        await eventRepo.markProcessed(event.eventId, event.eventType ?? 'tenant.provisioning.requested', client);
    });
};

export const connectConsumer = async (reason = 'startup'): Promise<void> => {
    if (shutdownRequested || consumer || connectPromise) return;

    const nextConsumer = kafka.consumer({ groupId: `${config.KAFKA_GROUP_ID}-tenant-provisioning` });
    consumer = nextConsumer;

    connectPromise = (async () => {
        try {
            await nextConsumer.connect();
            if (shutdownRequested) {
                await nextConsumer.disconnect();
                return;
            }

            await nextConsumer.subscribe({ topic: 'tenant.provisioning.requested', fromBeginning: false });
            await nextConsumer.run({
                eachMessage: async ({ message }) => {
                    const value = message.value?.toString();
                    if (!value) return;
                    let event: any = {};
                    try {
                        event = JSON.parse(value);
                        await processTenantProvisioningRequested(event);
                    } catch (err) {
                        await eventRepo.recordFailure({
                            eventId: event?.eventId,
                            eventType: event?.eventType ?? 'tenant.provisioning.requested',
                            topic: 'tenant.provisioning.requested',
                            payload: event,
                            errorMessage: err instanceof Error ? err.message : String(err),
                        });
                        await publishDlq('tenant.provisioning.requested', event, err);
                        throw err;
                    }
                },
            });

            retryAttempt = 0;
            logger.info(' Kafka consumer connected for tenant provisioning');
        } catch (err: any) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (consumer === nextConsumer) {
                consumer = null;
            }
            logger.warn('Kafka consumer connection attempt failed; tenant provisioning remains degraded', {
                reason,
                error: errorMessage,
            });
            try {
                await nextConsumer.disconnect();
            } catch {
                // Ignore cleanup failures.
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
        logger.info('Kafka tenant provisioning consumer disconnected');
    }
    if (dlqProducer) {
        await dlqProducer.disconnect();
        dlqProducer = null;
    }
};
