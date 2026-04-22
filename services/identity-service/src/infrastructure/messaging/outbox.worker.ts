import { getPool } from '../database/db';
import { publishEvent } from './kafka.producer';
import { logger } from '../../config/logger';
const POLLING_INTERVAL_MS = 2000;
const BATCH_SIZE = 50;
const CLAIM_TIMEOUT_SECONDS = 60;
let isWorkerRunning = false;
let timeoutId: NodeJS.Timeout | null = null;
const claimOutboxBatch = async () => {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `UPDATE outbox_events
         SET claimed_at = NOW()
       WHERE id IN (
         SELECT id
           FROM outbox_events
          WHERE processed_at IS NULL
            AND (claimed_at IS NULL OR claimed_at < NOW() - ($2::text || ' seconds')::interval)
          ORDER BY created_at ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
            [BATCH_SIZE, CLAIM_TIMEOUT_SECONDS]
        );
        await client.query('COMMIT');
        return rows;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};
const processOutbox = async () => {
    const pool = getPool();
    try {
        const rows = await claimOutboxBatch();
        for (const row of rows) {
            try {
                const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
                await publishEvent(row.event_type, payload);
                await pool.query(
                    `UPDATE outbox_events
                SET processed_at = NOW(), claimed_at = NULL
              WHERE id = $1`,
                    [row.id]
                );
            } catch (err: any) {
                await pool.query(
                    `UPDATE outbox_events
                SET claimed_at = NULL
              WHERE id = $1 AND processed_at IS NULL`,
                    [row.id]
                );
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
    logger.info(' Identity outbox worker started');
    void processOutbox();
};
export const stopOutboxWorker = () => {
    isWorkerRunning = false;
    if (timeoutId) clearTimeout(timeoutId);
    logger.info('Identity outbox worker stopped');
};
