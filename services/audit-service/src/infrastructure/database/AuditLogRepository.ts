import { getPool } from './db';
export class AuditLogRepository {
    async recordEvent(
        eventId: string,
        eventType: string,
        aggregateId: string,
        occurredAt: string,
        payload: any,
        correlationId?: string
    ): Promise<void> {
        try {
            await getPool().query(
                `INSERT INTO audit_logs (event_id, event_type, aggregate_id, occurred_at, payload, correlation_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
                [eventId, eventType, aggregateId, occurredAt, JSON.stringify(payload), correlationId ?? null]
            );
        } catch (err: any) {
            if (err.code === '23505') {
                return;
            }
            throw err;
        }
    }
}
