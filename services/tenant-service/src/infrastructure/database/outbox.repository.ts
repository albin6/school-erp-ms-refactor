import { PoolClient } from 'pg';
import { DomainEvent } from '../../domain/events/tenant.events';
export const insertOutboxEvent = async (
    client: PoolClient,
    event: DomainEvent,
    aggregateType: 'Tenant' | 'Membership'
): Promise<void> => {
    await client.query(
        `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, event_version, correlation_id, causation_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
            aggregateType,
            event.aggregateId,
            event.eventType,
            1,
            event.correlationId ?? null,
            (event as any).causationId ?? null,
            JSON.stringify({ eventVersion: 1, aggregateType, ...event }),
        ]
    );
};
