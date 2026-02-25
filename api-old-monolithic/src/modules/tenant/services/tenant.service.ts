import { Tenant, TenantUser, User } from "../../../infrastructure/database/models";
import { AppError } from "../../../core/utils/AppError";
import { CreateTenantDTO, UpdateTenantDTO, TenantQueryDTO } from "../dtos/tenant.schema";
import { Op } from "sequelize";
export class TenantService {
    static async createTenant(data: CreateTenantDTO, createdBy: string) {
        const { generateTemporaryPassword } = require("../../../core/utils/password.utils");
        const { hashPassword } = require("../../../core/security/password.service");
        const { emailService } = require("../../../core/services/email.service");
        const existing = await Tenant.findOne({ where: { subdomain: data.subdomain } });
        if (existing) {
            throw new AppError("Subdomain already exists", 409);
        }
        const existingUser = await User.findOne({ where: { email: data.admin_email } });
        if (existingUser) {
            throw new AppError("Admin email already exists", 409);
        }
        const temporaryPassword = generateTemporaryPassword();
        const hashedPassword = await hashPassword(temporaryPassword);
        console.log(`\n${'='.repeat(60)}`);
        console.log(` TENANT ADMIN CREDENTIALS`);
        console.log(`${'='.repeat(60)}`);
        console.log(`Tenant: ${data.name}`);
        console.log(`Subdomain: ${data.subdomain}`);
        console.log(`Admin Email: ${data.admin_email}`);
        console.log(`Temporary Password: ${temporaryPassword}`);
        console.log(`Login URL: ${process.env.PROTOCOL || 'http'}:
        console.log(`${'='.repeat(60)}\n`);
        const tenant = await Tenant.create({
            name: data.name,
            subdomain: data.subdomain,
            domain: data.domain,
            settings: data.settings || {},
            created_by: createdBy,
        });
        const adminUser = await User.create({
            email: data.admin_email,
            password_hash: hashedPassword,
            name: `${data.name} Admin`,
            is_super_admin: false,
            is_active: true,
            must_reset_password: true,
        });
        await TenantUser.create({
            user_id: adminUser.id,
            tenant_id: tenant.id,
            role: 'ADMIN',
            sub_role: null,
        });
        try {
            await emailService.sendTenantAdminCredentials(
                data.admin_email,
                data.name,
                data.subdomain,
                temporaryPassword
            );
            console.log(` Credentials email sent to ${data.admin_email}`);
        } catch (emailError) {
            console.error('️ Failed to send credentials email:', emailError);
        }
        return {
            tenant,
            admin: {
                id: adminUser.id,
                email: adminUser.email,
                name: adminUser.name,
            }
        };
    }
    static async getTenants(query: TenantQueryDTO) {
        const { page, limit, search, status, sortBy, sortOrder } = query;
        const offset = (page - 1) * limit;
        const where: any = {};
        if (search) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { subdomain: { [Op.iLike]: `%${search}%` } },
            ];
        }
        if (status) {
            where.status = status;
        }
        const { rows: tenants, count: total } = await Tenant.findAndCountAll({
            where,
            limit,
            offset,
            order: [[sortBy, sortOrder.toUpperCase()]],
        });
        return {
            tenants,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    static async getTenantById(id: string) {
        const tenant = await Tenant.findByPk(id);
        if (!tenant) {
            throw new AppError("Tenant not found", 404);
        }
        return tenant;
    }
    static async getTenantBySubdomain(subdomain: string) {
        const tenant = await Tenant.findOne({ where: { subdomain } });
        if (!tenant) {
            throw new AppError("Tenant not found", 404);
        }
        return tenant;
    }
    static async checkAvailability(subdomain: string, excludeId?: string) {
        const where: any = { subdomain };
        if (excludeId) {
            where.id = { [Op.ne]: excludeId };
        }
        const count = await Tenant.count({ where });
        return {
            available: count === 0,
            exists: count > 0
        };
    }
    static async updateTenant(id: string, data: UpdateTenantDTO) {
        const tenant = await this.getTenantById(id);
        await tenant.update(data);
        return tenant;
    }
    static async deleteTenant(id: string) {
        const transaction = await Tenant.sequelize!.transaction();
        try {
            const tenant = await this.getTenantById(id);
            const tenantUsers = await TenantUser.findAll({
                where: { tenant_id: id },
                attributes: ['user_id'],
                transaction
            });
            const userIds = tenantUsers.map(tu => tu.user_id);
            await TenantUser.destroy({
                where: { tenant_id: id },
                transaction
            });
            if (userIds.length > 0) {
                await User.destroy({
                    where: { id: userIds },
                    transaction
                });
            }
            await tenant.destroy({ transaction });
            await transaction.commit();
            return { message: "Tenant and all associated data, including users, deleted successfully" };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    static async blockTenant(id: string) {
        const tenant = await this.getTenantById(id);
        await tenant.update({
            is_active: false,
            status: 'SUSPENDED'
        });
        return { message: "Tenant blocked successfully", tenant };
    }
    static async unblockTenant(id: string) {
        const tenant = await this.getTenantById(id);
        await tenant.update({
            is_active: true,
            status: 'ACTIVE'
        });
        return { message: "Tenant unblocked successfully", tenant };
    }
    static async getTenantUsers(tenantId: string, query: { page: number; limit: number; role?: string }) {
        const { page, limit, role } = query;
        const offset = (page - 1) * limit;
        const where: any = { tenant_id: tenantId };
        if (role) {
            where.role = role;
        }
        const { rows: tenantUsers, count: total } = await TenantUser.findAndCountAll({
            where,
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'email', 'name', 'is_active'],
                },
            ],
            limit,
            offset,
            order: [['created_at', 'DESC']],
        });
        return {
            users: tenantUsers,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
