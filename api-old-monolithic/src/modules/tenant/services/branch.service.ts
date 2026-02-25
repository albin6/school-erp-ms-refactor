import { Branch, Tenant, TenantUser } from "../../../infrastructure/database/models";
import { AppError } from "../../../core/utils/AppError";
import { Op } from "sequelize";
interface CreateBranchDTO {
    name: string;
    slug: string;
    address?: string;
    phone?: string;
    email?: string;
}
interface UpdateBranchDTO {
    name?: string;
    slug?: string;
    address?: string;
    phone?: string;
    email?: string;
    status?: 'ACTIVE' | 'BLOCKED';
}
interface BranchQueryOptions {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'ACTIVE' | 'BLOCKED';
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}
export class BranchService {
    static async createBranch(tenantId: string, data: CreateBranchDTO) {
        const existing = await Branch.findOne({
            where: { tenant_id: tenantId, name: data.name }
        });
        if (existing) {
            throw new AppError("Branch with this name already exists", 409);
        }
        return await Branch.create({
            ...data,
            tenant_id: tenantId,
            name: data.name,
            slug: data.slug,
            address: data.address,
            phone: data.phone,
            email: data.email,
            status: 'ACTIVE'
        });
    }
    static async getBranches(tenantId: string, options: BranchQueryOptions) {
        const page = options.page || 1;
        const limit = options.limit || 10;
        const offset = (page - 1) * limit;
        const where: any = { tenant_id: tenantId };
        if (options.status) {
            where.status = options.status;
        }
        if (options.search) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${options.search}%` } },
                { address: { [Op.iLike]: `%${options.search}%` } }
            ];
        }
        const order: any[] = [];
        if (options.sortBy) {
            order.push([options.sortBy, options.sortOrder || 'ASC']);
        } else {
            order.push(['created_at', 'DESC']);
        }
        const { rows, count } = await Branch.findAndCountAll({
            where,
            limit,
            offset,
            order,
            distinct: true
        });
        return {
            branches: rows,
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit)
            }
        };
    }
    static async getBranch(tenantId: string, branchId: string) {
        const branch = await Branch.findOne({
            where: { id: branchId, tenant_id: tenantId }
        });
        if (!branch) {
            throw new AppError("Branch not found", 404);
        }
        return branch;
    }
    static async updateBranch(tenantId: string, branchId: string, data: UpdateBranchDTO) {
        const branch = await this.getBranch(tenantId, branchId);
        if (data.name && data.name !== branch.name) {
            const existing = await Branch.findOne({
                where: { tenant_id: tenantId, name: data.name }
            });
            if (existing) throw new AppError("Branch name already taken", 409);
        }
        return await branch.update(data);
    }
    static async checkSlugAvailability(tenantId: string, slug: string): Promise<boolean> {
        const count = await Branch.count({
            where: {
                tenant_id: tenantId,
                slug: slug
            }
        });
        return count === 0;
    }
    static async getBranchBySlug(tenantId: string, slug: string) {
        const branch = await Branch.findOne({
            where: { tenant_id: tenantId, slug: slug }
        });
        if (!branch) {
            throw new AppError("Branch not found", 404);
        }
        return branch;
    }
    static async deleteBranch(tenantId: string, branchId: string) {
        const branch = await this.getBranch(tenantId, branchId);
        const linkedUsers = await TenantUser.count({ where: { branch_id: branchId } });
        if (linkedUsers > 0) {
            throw new AppError(`Cannot delete branch. ${linkedUsers} users are linked to it.`, 400);
        }
        await branch.destroy();
    }
    static async getPublicBranches(subdomain: string, search?: string) {
        const tenant = await Tenant.findOne({
            where: { subdomain: subdomain, status: 'ACTIVE' }
        });
        if (!tenant) {
            throw new AppError("School not found", 404);
        }
        const where: any = {
            tenant_id: tenant.id,
            status: 'ACTIVE'
        };
        if (search) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { address: { [Op.iLike]: `%${search}%` } }
            ];
        }
        return await Branch.findAll({
            where,
            limit: 20,
            order: [['name', 'ASC']]
        });
    }
    static async getPublicBranchBySlug(subdomain: string, slug: string) {
        const tenant = await Tenant.findOne({
            where: { subdomain: subdomain, status: 'ACTIVE' }
        });
        if (!tenant) {
            throw new AppError("School not found", 404);
        }
        const branch = await Branch.findOne({
            where: {
                tenant_id: tenant.id,
                slug: slug,
                status: 'ACTIVE'
            }
        });
        if (!branch) {
            throw new AppError("Branch not found", 404);
        }
        return branch;
    }
    static async toggleBlock(tenantId: string, branchId: string) {
        const branch = await this.getBranch(tenantId, branchId);
        const newStatus = branch.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
        return await branch.update({ status: newStatus });
    }
}
