import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../domain/errors/AppError';
import { logger } from '../../../config/logger';
import { getPool } from '../../../infrastructure/database/db';
import { TenantRepository } from '../../../infrastructure/database/TenantRepository';

const tenantRepo = new TenantRepository();

export const getDashboardStatsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { tenantId } = req.params;
        const tenant = await tenantRepo.findById(tenantId);
        if (!tenant) {
            throw new AppError('Tenant not found', 404);
        }

        logger.info(`Getting dashboard stats for tenant: ${tenantId}`);

        const { rows } = await getPool().query(
            `SELECT
                COUNT(*) FILTER (WHERE role = 'STUDENT')::int AS total_students,
                COUNT(*) FILTER (WHERE role = 'STAFF')::int AS total_staff,
                COUNT(*) FILTER (WHERE role = 'ADMIN')::int AS total_admins,
                COUNT(*)::int AS total_users,
                COUNT(*)::int AS active_users,
                COUNT(*) FILTER (
                    WHERE role = 'STUDENT' AND created_at >= NOW() - INTERVAL '30 days'
                )::int AS recent_enrollments
             FROM memberships
             WHERE tenant_id = $1`,
            [tenantId]
        );

        const stats = rows[0] ?? {};
        res.status(200).json({
            success: true,
            data: {
                totalStudents: stats.total_students ?? 0,
                totalStaff: stats.total_staff ?? 0,
                totalAdmins: stats.total_admins ?? 0,
                totalUsers: stats.total_users ?? 0,
                activeUsers: stats.active_users ?? 0,
                recentEnrollments: stats.recent_enrollments ?? 0,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const getDashboardActivitiesController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { tenantId } = req.params;
        const tenant = await tenantRepo.findById(tenantId);
        if (!tenant) {
            throw new AppError('Tenant not found', 404);
        }

        const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '10'), 10) || 10, 1), 50);
        logger.info(`Getting dashboard activities for tenant: ${tenantId}`);

        const { rows } = await getPool().query(
            `SELECT *
             FROM (
                SELECT
                    t.id::text AS id,
                    'tenant_created'::text AS action,
                    'tenant'::text AS resource,
                    NULL::jsonb AS "user",
                    t.created_at AS "timestamp",
                    ''::text AS "ipAddress"
                FROM tenants t
                WHERE t.id = $1

                UNION ALL

                SELECT
                    b.id::text AS id,
                    'branch_created'::text AS action,
                    'branch'::text AS resource,
                    NULL::jsonb AS "user",
                    b.created_at AS "timestamp",
                    ''::text AS "ipAddress"
                FROM branches b
                WHERE b.tenant_id = $1

                UNION ALL

                SELECT
                    m.id::text AS id,
                    CASE
                        WHEN m.role = 'ADMIN' THEN 'admin_added'
                        WHEN m.role = 'STAFF' THEN 'staff_added'
                        ELSE 'student_added'
                    END::text AS action,
                    'membership'::text AS resource,
                    NULL::jsonb AS "user",
                    m.created_at AS "timestamp",
                    ''::text AS "ipAddress"
                FROM memberships m
                WHERE m.tenant_id = $1
             ) activities
             ORDER BY "timestamp" DESC
             LIMIT $2`,
            [tenantId, limit]
        );

        res.status(200).json({
            success: true,
            data: rows,
        });
    } catch (error) {
        next(error);
    }
};
