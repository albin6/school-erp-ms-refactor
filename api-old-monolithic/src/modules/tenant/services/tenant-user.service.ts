import { TenantUser, User, Branch } from "../../../infrastructure/database/models";
import { AppError } from "../../../core/utils/AppError";
import { Op } from "sequelize";
import { User as UserModel } from "../../../infrastructure/database/models/User";
interface CreateUserDTO {
    email: string;
    name: string;
    role: 'STAFF' | 'STUDENT';
    sub_role?: string;
    branch_id?: string;
}
interface UpdateUserDTO {
    name?: string;
    email?: string;
    role?: 'STAFF' | 'STUDENT';
    sub_role?: string;
    branch_id?: string;
    status?: 'ACTIVE' | 'BLOCKED';
}
interface UserQueryOptions {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    sub_role?: string;
    branch_id?: string;
    status?: 'ACTIVE' | 'BLOCKED';
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}
export class TenantUserService {
    static async createUser(tenantId: string, data: CreateUserDTO) {
        const { generateTemporaryPassword } = require("../../../core/utils/password.utils");
        const { hashPassword } = require("../../../core/security/password.service");
        const { emailService } = require("../../../core/services/email.service");
        if (data.role === 'STAFF' && data.sub_role === 'PRINCIPAL' && data.branch_id) {
            const existingPrincipal = await TenantUser.findOne({
                where: {
                    tenant_id: tenantId,
                    branch_id: data.branch_id,
                    role: 'STAFF',
                    sub_role: 'PRINCIPAL'
                }
            });
            if (existingPrincipal) {
                throw new AppError("This branch already has a Principal assigned.", 400);
            }
        }
        if ((data.role === 'STAFF' || data.role === 'STUDENT') && !data.branch_id) {
            throw new AppError("Branch assignment is required for this role.", 400);
        }
        const transaction = await TenantUser.sequelize!.transaction();
        try {
            let user = await User.findOne({ where: { email: data.email }, transaction });
            if (user) {
                const existingLink = await TenantUser.findOne({
                    where: { user_id: user.id, tenant_id: tenantId },
                    transaction
                });
                if (existingLink) {
                    throw new AppError("User already exists in this tenant", 409);
                }
            } else {
                const tempPassword = generateTemporaryPassword();
                const hashedPassword = await hashPassword(tempPassword);
                user = await User.create({
                    email: data.email,
                    name: data.name,
                    password_hash: hashedPassword,
                    is_super_admin: false,
                    is_active: true,
                    must_reset_password: true
                }, { transaction });
                console.log(`[TenantUser] Created user ${data.email} with pwd: ${tempPassword}`);
            }
            const tenantUser = await TenantUser.create({
                user_id: user.id,
                tenant_id: tenantId,
                role: data.role,
                sub_role: data.sub_role || null,
                branch_id: data.branch_id || null
            }, { transaction });
            await transaction.commit();
            return {
                ...tenantUser.toJSON(),
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email
                }
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    static async getUsers(tenantId: string, options: UserQueryOptions) {
        const page = options.page || 1;
        const limit = options.limit || 10;
        const offset = (page - 1) * limit;
        const where: any = { tenant_id: tenantId };
        if (options.role) {
            where.role = options.role;
        } else {
            where.role = { [Op.ne]: 'ADMIN' };
        }
        if (options.sub_role) where.sub_role = options.sub_role;
        if (options.branch_id) where.branch_id = options.branch_id;
        const userWhere: any = {};
        if (options.search) {
            userWhere[Op.or] = [
                { name: { [Op.iLike]: `%${options.search}%` } },
                { email: { [Op.iLike]: `%${options.search}%` } }
            ];
        }
        if (options.status) {
            userWhere.is_active = options.status === 'ACTIVE';
        }
        const { rows, count } = await TenantUser.findAndCountAll({
            where,
            include: [
                {
                    model: User,
                    as: 'user',
                    where: userWhere,
                    attributes: ['id', 'name', 'email', 'is_active', 'last_login_at']
                },
                {
                    model: Branch,
                    as: 'branch',
                    attributes: ['id', 'name']
                }
            ],
            limit,
            offset,
            order: [['created_at', options.sortOrder || 'DESC']]
        });
        return {
            users: rows,
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit)
            }
        };
    }
    static async updateUser(tenantId: string, userId: string, data: UpdateUserDTO) {
        const tenantUser = await TenantUser.findOne({
            where: { user_id: userId, tenant_id: tenantId },
            include: [{ model: User, as: 'user' }]
        });
        if (!tenantUser) throw new AppError("User not found in this tenant", 404);
        const transaction = await TenantUser.sequelize!.transaction();
        try {
            if (data.role) tenantUser.role = data.role;
            if (data.sub_role !== undefined) tenantUser.sub_role = data.sub_role;
            if (data.branch_id !== undefined) tenantUser.branch_id = data.branch_id;
            await tenantUser.save({ transaction });
            const user = await User.findByPk(userId, { transaction });
            if (user) {
                if (data.name) user.name = data.name;
                if (data.email && data.email !== user.email) {
                    const exists = await User.findOne({ where: { email: data.email }, transaction });
                    if (exists) throw new AppError("Email already taken", 409);
                    user.email = data.email;
                }
                if (data.status) {
                    user.is_active = data.status === 'ACTIVE';
                }
                await user.save({ transaction });
            }
            await transaction.commit();
            return await tenantUser.reload();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    static async deleteUser(tenantId: string, userId: string) {
        const transaction = await TenantUser.sequelize!.transaction();
        try {
            const tenantUser = await TenantUser.findOne({
                where: { user_id: userId, tenant_id: tenantId },
                transaction
            });
            if (!tenantUser) throw new AppError("User not found", 404);
            await tenantUser.destroy({ transaction });
            const otherLinks = await TenantUser.count({
                where: { user_id: userId },
                transaction
            });
            if (otherLinks === 0) {
                await User.destroy({ where: { id: userId }, transaction });
            }
            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
}
