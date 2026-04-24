import { getPool } from './db';
export interface BranchRecord {
    id: string;
    tenant_id: string;
    name: string;
    slug: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    status: string;
    created_at: Date;
    updated_at: Date;
}
export class BranchRepository {
    async listByTenant(tenantId: string): Promise<BranchRecord[]> {
        const { rows } = await getPool().query(
            `SELECT * FROM branches
         WHERE tenant_id = $1
         ORDER BY created_at DESC`,
            [tenantId]
        );
        return rows;
    }
    async listPublicByTenant(tenantId: string, search?: string): Promise<BranchRecord[]> {
        const normalizedSearch = search?.trim();
        const values = [tenantId];
        let query = `SELECT * FROM branches
         WHERE tenant_id = $1
           AND status = 'ACTIVE'`;

        if (normalizedSearch) {
            values.push(`%${normalizedSearch}%`);
            query += `
           AND name ILIKE $2`;
        }

        query += `
         ORDER BY created_at DESC`;

        const { rows } = await getPool().query(query, values);
        return rows;
    }
    async findById(tenantId: string, branchId: string): Promise<BranchRecord | null> {
        const { rows } = await getPool().query(
            `SELECT * FROM branches
         WHERE tenant_id = $1 AND id = $2`,
            [tenantId, branchId]
        );
        return rows[0] ?? null;
    }
    async findPublicBySlug(tenantId: string, slug: string): Promise<BranchRecord | null> {
        const { rows } = await getPool().query(
            `SELECT * FROM branches
         WHERE tenant_id = $1
           AND slug = $2
           AND status = 'ACTIVE'`,
            [tenantId, slug]
        );
        return rows[0] ?? null;
    }
    async create(input: {
        tenantId: string;
        name: string;
        slug: string;
        address?: string;
        phone?: string;
        email?: string;
    }): Promise<BranchRecord> {
        const { rows } = await getPool().query(
            `INSERT INTO branches (tenant_id, name, slug, address, phone, email)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
            [input.tenantId, input.name, input.slug, input.address ?? null, input.phone ?? null, input.email ?? null]
        );
        return rows[0];
    }
}
