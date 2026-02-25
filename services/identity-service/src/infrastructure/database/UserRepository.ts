import { PoolClient } from 'pg';
import { getPool } from './db';
import { User } from '../../domain/aggregates/User';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
export class UserRepository implements IUserRepository {
    private toAggregate(row: Record<string, unknown>): User {
        return new User({
            id: row.id as string,
            email: row.email as string,
            passwordHash: row.password_hash as string,
            name: row.name as string,
            isSuperAdmin: row.is_super_admin as boolean,
            failedLoginAttempts: row.failed_login_attempts as number,
            lockoutUntil: row.lockout_until as Date | null,
            lastLoginAt: row.last_login_at as Date | null,
            isActive: row.is_active as boolean,
            mustResetPassword: row.must_reset_password as boolean,
            createdAt: row.created_at as Date,
            updatedAt: row.updated_at as Date,
        });
    }
    async findById(id: string): Promise<User | null> {
        const { rows } = await getPool().query(
            `SELECT * FROM users WHERE id = $1`,
            [id]
        );
        return rows[0] ? this.toAggregate(rows[0]) : null;
    }
    async findByEmail(email: string): Promise<User | null> {
        const { rows } = await getPool().query(
            `SELECT * FROM users WHERE email = $1`,
            [email.toLowerCase().trim()]
        );
        return rows[0] ? this.toAggregate(rows[0]) : null;
    }
    async existsByEmail(email: string): Promise<boolean> {
        const { rows } = await getPool().query(
            `SELECT 1 FROM users WHERE email = $1`,
            [email.toLowerCase().trim()]
        );
        return rows.length > 0;
    }
    async save(user: User, client?: PoolClient): Promise<User> {
        const executor = client ?? getPool();
        const { rows } = await executor.query(
            `INSERT INTO users (
        id, email, password_hash, name, is_super_admin,
        failed_login_attempts, lockout_until, last_login_at,
        is_active, must_reset_password, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
            [
                user.id, user.email, user.passwordHash, user.name,
                user.isSuperAdmin, user.failedLoginAttempts, user.lockoutUntil,
                user.lastLoginAt, user.isActive, user.mustResetPassword,
                user.createdAt, user.updatedAt,
            ]
        );
        return this.toAggregate(rows[0]);
    }
    async update(user: User, client?: PoolClient): Promise<User> {
        const executor = client ?? getPool();
        const { rows } = await executor.query(
            `UPDATE users SET
        email = $2, password_hash = $3, name = $4,
        is_super_admin = $5, failed_login_attempts = $6,
        lockout_until = $7, last_login_at = $8,
        is_active = $9, must_reset_password = $10,
        updated_at = $11
      WHERE id = $1
      RETURNING *`,
            [
                user.id, user.email, user.passwordHash, user.name,
                user.isSuperAdmin, user.failedLoginAttempts, user.lockoutUntil,
                user.lastLoginAt, user.isActive, user.mustResetPassword,
                new Date(),
            ]
        );
        return this.toAggregate(rows[0]);
    }
    async delete(id: string): Promise<void> {
        await getPool().query(`DELETE FROM users WHERE id = $1`, [id]);
    }
}
