import { PoolClient } from 'pg';
import { DomainEvent } from '../../domain/events/tenant.events';
export const insertOutboxEvent = async (
    client: PoolClient,
    event: DomainEvent,
    aggregateType: 'Tenant' | 'Membership'
): Promise<void> => {
    await client.query(
        `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
     VALUES ($1, $2, $3, $4)`,
        [aggregateType, event.aggregateId, event.eventType, JSON.stringify(event)]
    );
};
