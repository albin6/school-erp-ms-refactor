import { TenantUser, User, AuditLog } from "../../../infrastructure/database/models";
import { AppError } from "../../../core/utils/AppError";
import { Op } from "sequelize";
export class DashboardService {
    static async getStatistics(tenantId: string) {
        const totalStudents = await TenantUser.count({
            where: { tenant_id: tenantId, role: 'STUDENT' }
        });
        const totalStaff = await TenantUser.count({
            where: { tenant_id: tenantId, role: 'STAFF' }
        });
        const totalAdmins = await TenantUser.count({
            where: { tenant_id: tenantId, role: 'ADMIN' }
        });
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const activeUsers = await TenantUser.count({
            where: { tenant_id: tenantId },
            include: [{
                model: User,
                as: 'user',
                where: {
                    last_login_at: {
                        [Op.gte]: sevenDaysAgo
                    }
                },
                required: true
            }]
        });
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentEnrollments = await TenantUser.count({
            where: {
                tenant_id: tenantId,
                created_at: {
                    [Op.gte]: thirtyDaysAgo
                }
            }
        });
        return {
            totalStudents,
            totalStaff,
            totalAdmins,
            totalUsers: totalStudents + totalStaff + totalAdmins,
            activeUsers,
            recentEnrollments,
        };
    }
    static async getRecentActivities(tenantId: string, limit: number = 10) {
        const activities = await AuditLog.findAll({
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'name', 'email'],
                include: [{
                    model: TenantUser,
                    as: 'tenantUsers',
                    where: { tenant_id: tenantId },
                    required: true,
                    attributes: []
                }]
            }],
            order: [['createdAt', 'DESC']],
            limit,
        });
        return activities.map((activity: any) => ({
            id: activity.id,
            action: activity.action,
            resource: activity.resource,
            user: activity.user ? {
                id: activity.user.id,
                name: activity.user.name,
                email: activity.user.email
            } : null,
            timestamp: activity.createdAt,
            ipAddress: activity.ip_address,
        }));
    }
    static async getTenantOverview(tenantId: string) {
        const { Tenant } = require("../../../infrastructure/database/models");
        const tenant = await Tenant.findByPk(tenantId);
        if (!tenant) {
            throw new AppError("Tenant not found", 404);
        }
        const statistics = await this.getStatistics(tenantId);
        return {
            tenant: {
                id: tenant.id,
                name: tenant.name,
                subdomain: tenant.subdomain,
                status: tenant.status,
                createdAt: tenant.created_at,
            },
            statistics,
        };
    }
}
