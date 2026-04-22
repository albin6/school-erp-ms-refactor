import { PoolClient } from 'pg';
import { getPool } from './db';
import { Tenant } from '../../domain/aggregates/Tenant';
import { ITenantRepository } from '../../domain/repositories/tenant.repositories';
export class TenantRepository implements ITenantRepository {
    private toAggregate(row: Record<string, any>): Tenant {
        return new Tenant({
            id: row.id,
            name: row.name,
            subdomain: row.subdomain,
            domain: row.domain,
            status: row.status,
            settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings,
            isActive: row.is_active,
            createdBy: row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }
    async findById(id: string): Promise<Tenant | null> {
        const { rows } = await getPool().query(`SELECT * FROM tenants WHERE id = $1`, [id]);
        return rows[0] ? this.toAggregate(rows[0]) : null;
    }
    async findBySubdomain(subdomain: string): Promise<Tenant | null> {
        const { rows } = await getPool().query(
            `SELECT * FROM tenants WHERE subdomain = $1 AND is_active = true`,
            [subdomain.toLowerCase().trim()]
        );
        return rows[0] ? this.toAggregate(rows[0]) : null;
    }
    async findByAnySubdomain(subdomain: string): Promise<Tenant | null> {
        const { rows } = await getPool().query(
            `SELECT * FROM tenants WHERE subdomain = $1`,
            [subdomain.toLowerCase().trim()]
        );
        return rows[0] ? this.toAggregate(rows[0]) : null;
    }
    async listPaginated(page: number, limit: number): Promise<{ tenants: Tenant[]; total: number }> {
        const offset = (page - 1) * limit;
        const [{ rows: countRows }, { rows }] = await Promise.all([
            getPool().query(`SELECT COUNT(*)::int AS total FROM tenants`),
            getPool().query(
                `SELECT * FROM tenants
             ORDER BY created_at DESC
             LIMIT $1 OFFSET $2`,
                [limit, offset]
            ),
        ]);
        return {
            tenants: rows.map((row) => this.toAggregate(row)),
            total: countRows[0]?.total ?? 0,
        };
    }
    async existsBySubdomain(subdomain: string): Promise<boolean> {
        const { rows } = await getPool().query(
            `SELECT 1 FROM tenants WHERE subdomain = $1`,
            [subdomain.toLowerCase().trim()]
        );
        return rows.length > 0;
    }
    async save(tenant: Tenant, client?: PoolClient): Promise<Tenant> {
        const executor = client ?? getPool();
        const { rows } = await executor.query(
            `INSERT INTO tenants (
        id, name, subdomain, domain, status, settings, is_active, created_by, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
            [
                tenant.id, tenant.name, tenant.subdomain, tenant.domain, tenant.status,
                JSON.stringify(tenant.settings), tenant.isActive, tenant.createdBy,
                tenant.createdAt, tenant.updatedAt,
            ]
        );
        return this.toAggregate(rows[0]);
    }
    async update(tenant: Tenant, client?: PoolClient): Promise<Tenant> {
        const executor = client ?? getPool();
        const { rows } = await executor.query(
            `UPDATE tenants SET
        name = $2, subdomain = $3, domain = $4, status = $5, settings = $6,
        is_active = $7, updated_at = $8
      WHERE id = $1
      RETURNING *`,
            [
                tenant.id, tenant.name, tenant.subdomain, tenant.domain, tenant.status,
                JSON.stringify(tenant.settings), tenant.isActive, new Date()
            ]
        );
        return this.toAggregate(rows[0]);
    }
    async delete(id: string): Promise<void> {
        await getPool().query(`DELETE FROM tenants WHERE id = $1`, [id]);
    }
}
