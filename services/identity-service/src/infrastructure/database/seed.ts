import { connectDB, getPool, closeDB } from './db';
import { hashPassword } from '../security/password.service';
import { config } from '../../config';
import { logger } from '../../config/logger';

const seed = async () => {
    try {
        await connectDB();
        const pool = getPool();

        const email = config.SUPER_ADMIN_EMAIL || 'admin@school.com';
        const password = config.SUPER_ADMIN_PASSWORD || 'Admin@123';

        logger.info(`Checking for Super Admin user: ${email}`);
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

        if (existing.rows.length > 0) {
            logger.info('Super Admin already exists.');
            return;
        }

        const passwordHash = await hashPassword(password);
        await pool.query(
            'INSERT INTO users (email, password_hash, name, is_super_admin, is_active) VALUES ($1, $2, $3, $4, $5)',
            [email, passwordHash, 'Super Admin', true, true]
        );

        logger.info(`Super Admin created successfully: ${email}`);
    } catch (err) {
        logger.error('Seed process failed:', err);
    } finally {
        await closeDB();
        process.exit(0);
    }
};

seed();
