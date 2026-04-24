import { PoolClient } from 'pg';
import { getPool } from './db';

export interface PasswordResetTokenRecord {
    id: string;
    email: string;
    otp_hash: string;
    expires_at: Date;
    used_at: Date | null;
    attempts: number;
    max_attempts: number;
    ip_address: string | null;
    created_at: Date;
}

export class PasswordResetTokenRepository {
    private normalizeEmail(email: string): string {
        return email.toLowerCase().trim();
    }

    async invalidateActiveTokens(email: string, client?: PoolClient): Promise<void> {
        const executor = client ?? getPool();
        await executor.query(
            `UPDATE password_reset_tokens
             SET used_at = NOW()
             WHERE email = $1
               AND used_at IS NULL
               AND expires_at > NOW()`,
            [this.normalizeEmail(email)]
        );
    }

    async create(email: string, otpHash: string, expiresAt: Date, ipAddress?: string, client?: PoolClient): Promise<PasswordResetTokenRecord> {
        const executor = client ?? getPool();
        const { rows } = await executor.query(
            `INSERT INTO password_reset_tokens (email, otp_hash, expires_at, ip_address)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [this.normalizeEmail(email), otpHash, expiresAt, ipAddress ?? null]
        );
        return rows[0] as PasswordResetTokenRecord;
    }

    async findLatestActiveByEmail(email: string): Promise<PasswordResetTokenRecord | null> {
        const { rows } = await getPool().query(
            `SELECT *
             FROM password_reset_tokens
             WHERE email = $1
               AND used_at IS NULL
               AND expires_at > NOW()
             ORDER BY created_at DESC
             LIMIT 1`,
            [this.normalizeEmail(email)]
        );
        return (rows[0] as PasswordResetTokenRecord | undefined) ?? null;
    }

    async incrementAttempts(id: string): Promise<void> {
        await getPool().query(
            `UPDATE password_reset_tokens
             SET attempts = attempts + 1
             WHERE id = $1`,
            [id]
        );
    }

    async markUsed(id: string): Promise<void> {
        await getPool().query(
            `UPDATE password_reset_tokens
             SET used_at = NOW()
             WHERE id = $1`,
            [id]
        );
    }
}
