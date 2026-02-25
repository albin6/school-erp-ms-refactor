import { getPool } from './db';
export class NotificationLogRepository {
    async tryLogEventProcessing(
        eventId: string,
        eventType: string,
        recipient: string,
        channel: string,
        status: 'SUCCESS' | 'FAILED',
        errorMessage?: string
    ): Promise<boolean> {
        try {
            await getPool().query(
                `INSERT INTO notification_logs (event_id, event_type, recipient, channel, status, error_message)
         VALUES ($1, $2, $3, $4, $5, $6)`,
                [eventId, eventType, recipient, channel, status, errorMessage ?? null]
            );
            return true;
        } catch (err: any) {
            if (err.code === '23505') {
                return false;
            }
            throw err;
        }
    }
}
