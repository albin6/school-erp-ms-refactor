import { getPool } from './db';
export class NotificationLogRepository {
    async claimEventProcessing(
        eventId: string,
        eventType: string,
        recipient: string,
        channel: string
    ): Promise<boolean> {
        try {
            await getPool().query(
                `INSERT INTO notification_logs (event_id, event_type, recipient, channel, status, error_message)
         VALUES ($1, $2, $3, $4, $5, $6)`,
                [eventId, eventType, recipient, channel, 'PROCESSING', null]
            );
            return true;
        } catch (err: any) {
            if (err.code === '23505') {
                return false;
            }
            throw err;
        }
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
         SET status = $4, error_message = $5
       WHERE event_id = $1 AND recipient = $2 AND channel = $3`,
            [eventId, recipient, channel, status, errorMessage ?? null]
        );
    }
}
