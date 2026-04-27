import { PoolClient } from 'pg';
import { getPool } from './db';

export interface UserSnapshot {
    userId: string;
    email: string;
    name: string;
    isActive: boolean;
    mustResetPassword: boolean;
    updatedAt: Date;
}

export interface UpsertUserSnapshotInput {
    userId: string;
    email: string;
    name: string;
    isActive?: boolean;
    mustResetPassword?: boolean;
}

export class UserSnapshotRepository {
    private mapRow(row: Record<string, any>): UserSnapshot {
        return {
            userId: row.user_id,
            email: row.email,
            name: row.name,
            isActive: row.is_active,
            mustResetPassword: row.must_reset_password,
            updatedAt: row.updated_at,
        };
    }

    async upsert(input: UpsertUserSnapshotInput, client?: PoolClient): Promise<UserSnapshot> {
        const executor = client ?? getPool();
        const { rows } = await executor.query(
            `INSERT INTO membership_user_snapshots (
                user_id, email, name, is_active, must_reset_password, updated_at
             ) VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (user_id) DO UPDATE SET
                email = EXCLUDED.email,
                name = EXCLUDED.name,
                is_active = EXCLUDED.is_active,
                must_reset_password = EXCLUDED.must_reset_password,
                updated_at = NOW()
             RETURNING *`,
            [
                input.userId,
                input.email,
                input.name,
                input.isActive ?? true,
                input.mustResetPassword ?? false,
            ]
        );
        return this.mapRow(rows[0]);
    }

    async findByUserIds(userIds: string[]): Promise<UserSnapshot[]> {
        const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
        if (uniqueUserIds.length === 0) {
            return [];
        }

        const { rows } = await getPool().query(
            `SELECT *
               FROM membership_user_snapshots
              WHERE user_id = ANY($1::uuid[])`,
            [uniqueUserIds]
        );
        return rows.map((row) => this.mapRow(row));
    }
}
