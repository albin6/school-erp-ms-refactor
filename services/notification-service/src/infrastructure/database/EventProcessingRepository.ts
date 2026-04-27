import { PoolClient } from 'pg';
import { getPool } from './db';

export class EventProcessingRepository {
    async hasProcessed(eventId: string): Promise<boolean> {
        const { rows } = await getPool().query(
            `SELECT 1 FROM processed_events WHERE event_id = $1`,
            [eventId]
        );
        return rows.length > 0;
    }

    async markProcessed(eventId: string, eventType: string, client?: PoolClient): Promise<void> {
        const executor = client ?? getPool();
        await executor.query(
            `INSERT INTO processed_events (event_id, event_type)
             VALUES ($1, $2)
             ON CONFLICT (event_id) DO NOTHING`,
            [eventId, eventType]
        );
    }

    async recordFailure(input: {
        eventId?: string;
        eventType?: string;
        topic: string;
        payload: unknown;
        errorMessage: string;
        attempts?: number;
    }): Promise<void> {
        await getPool().query(
            `INSERT INTO failed_events (event_id, event_type, topic, payload, error_message, attempts)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                input.eventId ?? null,
                input.eventType ?? null,
                input.topic,
                JSON.stringify(input.payload ?? {}),
                input.errorMessage,
                input.attempts ?? 1,
            ]
        );
    }
}
