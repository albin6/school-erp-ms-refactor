import { PoolClient } from 'pg';
import { getPool } from './db';
import { Membership } from '../../domain/aggregates/Membership';
import { IMembershipRepository } from '../../domain/repositories/tenant.repositories';
export class MembershipRepository implements IMembershipRepository {
    private toAggregate(row: Record<string, any>): Membership {
        return new Membership({
            id: row.id,
            userId: row.user_id,
            tenantId: row.tenant_id,
            branchId: row.branch_id,
            role: row.role,
            subRole: row.sub_role,
            authzVersion: Number(row.authz_version ?? 1),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }
    async findById(id: string): Promise<Membership | null> {
        const { rows } = await getPool().query(`SELECT * FROM memberships WHERE id = $1`, [id]);
        return rows[0] ? this.toAggregate(rows[0]) : null;
    }
    async findByUserAndTenant(userId: string, tenantId: string): Promise<Membership | null> {
        const { rows } = await getPool().query(
            `SELECT * FROM memberships WHERE user_id = $1 AND tenant_id = $2`,
            [userId, tenantId]
        );
        return rows[0] ? this.toAggregate(rows[0]) : null;
    }
    async findPrincipalByBranch(tenantId: string, branchId: string): Promise<Membership | null> {
        const { rows } = await getPool().query(
            `SELECT * FROM memberships
       WHERE tenant_id = $1 AND branch_id = $2 AND role = 'STAFF' AND sub_role = 'PRINCIPAL'`,
            [tenantId, branchId]
        );
        return rows[0] ? this.toAggregate(rows[0]) : null;
    }
    async save(membership: Membership, client?: PoolClient): Promise<Membership> {
        const executor = client ?? getPool();
        const { rows } = await executor.query(
            `INSERT INTO memberships (
        id, user_id, tenant_id, branch_id, role, sub_role, authz_version, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
            [
                membership.id, membership.userId, membership.tenantId, membership.branchId,
                membership.role, membership.subRole, membership.authzVersion, membership.createdAt, membership.updatedAt
            ]
        );
        return this.toAggregate(rows[0]);
    }
    async update(membership: Membership, client?: PoolClient): Promise<Membership> {
        const executor = client ?? getPool();
        const { rows } = await executor.query(
            `UPDATE memberships SET
        role = $2, sub_role = $3, branch_id = $4, authz_version = $5, updated_at = $6
      WHERE id = $1 AND tenant_id = $7
      RETURNING *`,
            [
                membership.id,
                membership.role,
                membership.subRole,
                membership.branchId,
                membership.authzVersion,
                new Date(),
                membership.tenantId,
            ]
        );
        if (!rows[0]) {
            throw new Error('Membership not found for tenant-scoped update');
        }
        return this.toAggregate(rows[0]);
    }
    async delete(id: string, client?: PoolClient): Promise<void> {
        const executor = client ?? getPool();
        await executor.query(`DELETE FROM memberships WHERE id = $1`, [id]);
    }
    async deleteByUserAndTenant(userId: string, tenantId: string, client?: PoolClient): Promise<boolean> {
        const executor = client ?? getPool();
        const result = await executor.query(
            `DELETE FROM memberships WHERE user_id = $1 AND tenant_id = $2`,
            [userId, tenantId]
        );
        return (result.rowCount ?? 0) > 0;
    }
}
