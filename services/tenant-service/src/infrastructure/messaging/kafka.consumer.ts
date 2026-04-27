import { Kafka, Consumer, Producer, Partitioners, logLevel } from 'kafkajs';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { UserSnapshotRepository } from '../database/UserSnapshotRepository';
import { TenantRepository } from '../database/TenantRepository';
import { MembershipRepository } from '../database/MembershipRepository';
import { Membership } from '../../domain/aggregates/Membership';
import { withTransaction } from '../database/db';
import { insertOutboxEvent } from '../database/outbox.repository';
import { v4 as uuidv4 } from 'uuid';
import { EventProcessingRepository } from '../database/EventProcessingRepository';

let consumer: Consumer | null = null;
let dlqProducer: Producer | null = null;
let connectPromise: Promise<void> | null = null;
let retryTimer: NodeJS.Timeout | null = null;
let retryAttempt = 0;
let shutdownRequested = false;

const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 30000;

const snapshotRepo = new UserSnapshotRepository();
const tenantRepo = new TenantRepository();
const membershipRepo = new MembershipRepository();
const eventRepo = new EventProcessingRepository();
const kafka = new Kafka({
    clientId: `${config.KAFKA_CLIENT_ID}-identity-events`,
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

    logger.warn(`Kafka consumer unavailable; user snapshots may be stale. Retrying in ${delayMs}ms`, {
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

const processIdentityUserEvent = async (event: any): Promise<void> => {
    if (typeof event?.eventId !== 'string' || !event.eventId.trim()) {
        throw new Error('Missing valid eventId');
    }
    if (await eventRepo.hasProcessed(event.eventId)) {
        logger.info('Skipping duplicate identity user event', { eventId: event.eventId });
        return;
    }
    const payload = event?.payload ?? event;
    const userId = payload.userId ?? payload.user_id;
    const email = payload.email;
    const name = payload.name;

    if (!userId || !email || !name) {
        logger.warn('Skipping identity user event without snapshot fields', {
            eventType: event?.eventType,
            eventId: event?.eventId,
        });
        throw new Error('Identity user event missing snapshot fields');
    }

    await snapshotRepo.upsert({
        userId,
        email,
        name,
        isActive: payload.isActive ?? payload.is_active ?? true,
        mustResetPassword: payload.mustResetPassword ?? payload.must_reset_password ?? false,
    });
    await eventRepo.markProcessed(event.eventId, event.eventType ?? 'identity.user.updated');
};

const processTenantAdminCreatedEvent = async (event: any): Promise<void> => {
    if (typeof event?.eventId !== 'string' || !event.eventId.trim()) {
        throw new Error('Missing valid eventId');
    }
    if (await eventRepo.hasProcessed(event.eventId)) {
        logger.info('Skipping duplicate tenant admin event', { eventId: event.eventId });
        return;
    }
    const payload = event?.payload ?? {};
    const tenantId = payload.tenantId;
    const userId = payload.userId;
    const email = payload.email;
    const name = payload.name;

    if (!tenantId || !userId || !email || !name) {
        logger.warn('Skipping tenant admin event with missing fields', {
            eventId: event?.eventId,
            eventType: event?.eventType,
        });
        return;
    }

    await withTransaction(async (client) => {
        const tenant = await tenantRepo.findById(tenantId);
        if (!tenant) {
            logger.warn('Skipping tenant admin event for missing tenant', { tenantId, userId });
            return;
        }

        const existingMembership = await membershipRepo.findByUserAndTenant(userId, tenantId);
        if (!existingMembership) {
            await membershipRepo.save(
                new Membership({
                    userId,
                    tenantId,
                    role: 'ADMIN',
                }),
                client
            );
        }

        if (email && name) {
            await snapshotRepo.upsert({ userId, email, name, isActive: true, mustResetPassword: true }, client);
        }

        tenant.activate();
        await tenantRepo.update(tenant, client);
        await client.query(
            `UPDATE tenant_provisioning_steps
                SET status = 'COMPLETED', updated_at = NOW(), last_error = NULL
              WHERE tenant_id = $1 AND step = 'ADMIN_USER'`,
            [tenantId]
        );
        await insertOutboxEvent(
            client,
            {
                eventId: uuidv4(),
                eventType: 'tenant.created',
                aggregateId: tenant.id,
                occurredAt: new Date().toISOString(),
                correlationId: event?.correlationId,
                payload: {
                    tenantId: tenant.id,
                    name: tenant.name,
                    subdomain: tenant.subdomain,
                    adminEmail: email,
                    createdBy: tenant.createdBy,
                },
            },
            'Tenant'
        );
        await insertOutboxEvent(
            client,
            {
                eventId: uuidv4(),
                eventType: 'tenant.activated',
                aggregateId: tenant.id,
                occurredAt: new Date().toISOString(),
                correlationId: event?.correlationId,
                payload: {
                    tenantId: tenant.id,
                    name: tenant.name,
                    subdomain: tenant.subdomain,
                    adminUserId: userId,
                },
            },
            'Tenant'
        );
        await eventRepo.markProcessed(event.eventId, event.eventType ?? 'identity.tenant_admin.created', client);
    });
};

export const connectConsumer = async (reason = 'startup'): Promise<void> => {
    if (shutdownRequested || consumer || connectPromise) return;

    const nextConsumer = kafka.consumer({ groupId: `${config.KAFKA_GROUP_ID}-identity-snapshots` });
    consumer = nextConsumer;

    connectPromise = (async () => {
        try {
            await nextConsumer.connect();

            if (shutdownRequested) {
                await nextConsumer.disconnect();
                return;
            }

            await nextConsumer.subscribe({ topic: 'identity.user.created', fromBeginning: false });
            await nextConsumer.subscribe({ topic: 'identity.user.updated', fromBeginning: false });
            await nextConsumer.subscribe({ topic: 'identity.tenant_admin.created', fromBeginning: false });
            await nextConsumer.run({
                eachMessage: async ({ topic, message }) => {
                    const value = message.value?.toString();
                    if (!value) return;
                    let event: any = {};
                    try {
                        event = JSON.parse(value);
                        if (topic === 'identity.tenant_admin.created') {
                            await processTenantAdminCreatedEvent(event);
                        } else {
                            await processIdentityUserEvent(event);
                        }
                        logger.debug('Processed identity event in tenant-service', {
                            topic,
                            eventType: event?.eventType,
                            eventId: event?.eventId,
                        });
                    } catch (err) {
                        await eventRepo.recordFailure({
                            eventId: event?.eventId,
                            eventType: event?.eventType ?? topic,
                            topic,
                            payload: event,
                            errorMessage: err instanceof Error ? err.message : String(err),
                        });
                        await publishDlq(topic, event, err);
                        throw err;
                    }
                },
            });

            retryAttempt = 0;
            logger.info(' Kafka consumer connected for identity user snapshots');
        } catch (err: any) {
            const errorMessage = err instanceof Error ? err.message : String(err);

            if (consumer === nextConsumer) {
                consumer = null;
            }

            logger.warn('Kafka consumer connection attempt failed; user snapshots may be stale', {
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
        logger.info('Kafka identity snapshot consumer disconnected');
    }
    if (dlqProducer) {
        await dlqProducer.disconnect();
        dlqProducer = null;
    }
};
