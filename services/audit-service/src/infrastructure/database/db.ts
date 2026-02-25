import { Pool } from 'pg';
import { config } from '../../config';
import { logger } from '../../config/logger';
let pool: Pool;
export const getPool = (): Pool => {
    if (!pool) {
        pool = new Pool({
            host: config.DB_HOST,
            port: config.DB_PORT,
            database: config.DB_NAME,
            user: config.DB_USER,
            password: config.DB_PASSWORD,
        });
        pool.on('error', (err) => logger.error('DB pool error', { error: err.message }));
    }
    return pool;
};
export const connectDB = async (): Promise<void> => {
    const p = getPool();
    const client = await p.connect();
    client.release();
    logger.info(' PostgreSQL connected (audit-db)');
};
export const closeDB = async (): Promise<void> => {
    if (pool) await pool.end();
};
