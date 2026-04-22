import { getPool } from './db';
const STALE_PROCESSING_MINUTES = 10;
export class NotificationLogRepository {
    async claimEventProcessing(
        eventId: string,
        eventType: string,
        recipient: string,
        channel: string
    ): Promise<boolean> {
        const { rowCount } = await getPool().query(
            `INSERT INTO notification_logs (
           event_id, event_type, recipient, channel, status, error_message, updated_at
         ) VALUES ($1, $2, $3, $4, 'PROCESSING', NULL, NOW())
         ON CONFLICT (event_id, recipient, channel)
         DO UPDATE
           SET status = 'PROCESSING',
               error_message = NULL,
               updated_at = NOW()
         WHERE notification_logs.status = 'FAILED'
            OR (
                 notification_logs.status = 'PROCESSING'
                 AND notification_logs.updated_at < NOW() - ($5::text || ' minutes')::interval
               )`,
            [eventId, eventType, recipient, channel, STALE_PROCESSING_MINUTES]
        );
        return rowCount > 0;
    }
    async markEventProcessed(
        eventId: string,
        recipient: string,
        channel: string,
        status: 'SUCCESS' | 'FAILED',
        errorMessage?: string
    ): Promise<void> {
        await getPool().query(
            `UPDATE notification_logs
         SET status = $4, error_message = $5, updated_at = NOW()
       WHERE event_id = $1 AND recipient = $2 AND channel = $3`,
            [eventId, recipient, channel, status, errorMessage ?? null]
        );
    }
}
