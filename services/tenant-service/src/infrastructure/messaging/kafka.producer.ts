import { Kafka, Producer, Partitioners, logLevel } from 'kafkajs';
import { config } from '../../config';
import { logger } from '../../config/logger';
let producer: Producer | null = null;
let connectPromise: Promise<void> | null = null;
let retryTimer: NodeJS.Timeout | null = null;
let retryAttempt = 0;
let shutdownRequested = false;

const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 30000;

const kafka = new Kafka({
    clientId: config.KAFKA_CLIENT_ID,
    brokers: config.KAFKA_BROKERS.split(','),
    logLevel: logLevel.WARN,
});

const createProducer = (): Producer =>
    kafka.producer({
        createPartitioner: Partitioners.LegacyPartitioner,
        allowAutoTopicCreation: true,
    });

const getRetryDelayMs = (attempt: number): number =>
    Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.max(1, attempt));

const scheduleReconnect = (reason: string, error?: string) => {
    if (shutdownRequested || retryTimer || connectPromise || producer) return;

    const nextAttempt = retryAttempt + 1;
    const delayMs = getRetryDelayMs(nextAttempt);

    logger.warn(`Kafka producer unavailable; tenant event publishing is degraded. Retrying in ${delayMs}ms`, {
        attempt: nextAttempt,
        reason,
        error,
    });

    retryTimer = setTimeout(() => {
        retryTimer = null;
        retryAttempt = nextAttempt;
        void connectProducer('retry');
    }, delayMs);
};

export const connectProducer = async (reason = 'startup'): Promise<void> => {
    if (shutdownRequested || producer || connectPromise) return;

    const nextProducer = createProducer();

    connectPromise = (async () => {
        try {
            await nextProducer.connect();

            if (shutdownRequested) {
                await nextProducer.disconnect();
                return;
            }

            producer = nextProducer;
            retryAttempt = 0;
            logger.info(' Kafka producer connected');
        } catch (err: any) {
            const errorMessage = err instanceof Error ? err.message : String(err);

            logger.warn('Kafka producer connection attempt failed; tenant event publishing remains degraded', {
                reason,
                error: errorMessage,
            });

            try {
                await nextProducer.disconnect();
            } catch {
                // Ignore cleanup failures for a producer that never connected cleanly.
            }

            scheduleReconnect(reason, errorMessage);
        } finally {
            connectPromise = null;
        }
    })();

    await connectPromise;
};

export const disconnectProducer = async (): Promise<void> => {
    shutdownRequested = true;

    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }

    if (producer) {
        const currentProducer = producer;
        producer = null;
        await currentProducer.disconnect();
    }
};

export const publishEvent = async (topic: string, key: string, payload: any): Promise<void> => {
    if (!producer) throw new Error('Producer not connected');

    try {
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
    } catch (err: any) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const currentProducer = producer;

        producer = null;

        try {
            await currentProducer.disconnect();
        } catch {
            // Ignore cleanup failures while transitioning back to degraded mode.
        }

        scheduleReconnect('publish-failure', errorMessage);
        throw err;
    }
};
