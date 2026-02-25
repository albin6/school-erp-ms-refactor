import { getPool } from '../database/db';
import { publishEvent } from './kafka.producer';
import { logger } from '../../config/logger';
const POLLING_INTERVAL_MS = 2000;
const BATCH_SIZE = 50;
let isWorkerRunning = false;
let timeoutId: NodeJS.Timeout | null = null;
const processOutbox = async () => {
    const pool = getPool();
    try {
        const { rows } = await pool.query(
            `SELECT * FROM outbox_events
       WHERE processed_at IS NULL
       ORDER BY created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT $1`,
            [BATCH_SIZE]
        );
        for (const row of rows) {
            try {
                const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
                await publishEvent(
                    row.event_type,
                    row.aggregate_id,
                    payload
                );
                await pool.query(
                    `UPDATE outbox_events SET processed_at = NOW() WHERE id = $1`,
                    [row.id]
                );
            } catch (err: any) {
                logger.error(`Outbox worker failed to process event ${row.id}`, { error: err.stack });
            }
        }
    } catch (err: any) {
        logger.error('Outbox polling error', { error: err.message });
    } finally {
        if (isWorkerRunning) {
            timeoutId = setTimeout(processOutbox, POLLING_INTERVAL_MS);
        }
    }
};
export const startOutboxWorker = () => {
    if (isWorkerRunning) return;
    isWorkerRunning = true;
    logger.info(' Outbox Relay Worker started');
    processOutbox();
};
export const stopOutboxWorker = () => {
    isWorkerRunning = false;
    if (timeoutId) clearTimeout(timeoutId);
    logger.info(' Outbox Relay Worker stopped');
};
