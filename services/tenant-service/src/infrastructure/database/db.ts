import { Pool, PoolClient } from 'pg';
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
            max: config.DB_POOL_MAX,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });
        pool.on('error', (err) => {
            logger.error('Unexpected DB pool error', { error: err.message });
        });
    }
    return pool;
};
export const connectDB = async (): Promise<void> => {
    const p = getPool();
    const client = await p.connect();
    client.release();
    logger.info(' PostgreSQL connected (tenant-db)');
};
export const closeDB = async (): Promise<void> => {
    if (pool) {
        await pool.end();
        logger.info('PostgreSQL pool closed');
    }
};
export const withTransaction = async <T>(
    fn: (client: PoolClient) => Promise<T>
): Promise<T> => {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};
