import { Request, Response, NextFunction } from "express";
import { DashboardService } from "../services/dashboard.service";
import { AppError } from "../../../core/utils/AppError";
import type { TenantRequest } from "../../../core/middleware/tenant.middleware";
export const getDashboardStats = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId;
        if (!tenantId) {
            throw new AppError("Tenant ID is required", 400);
        }
        const statistics = await DashboardService.getStatistics(tenantId);
        res.json({
            status: "success",
            data: statistics
        });
    } catch (error) {
        next(error);
    }
};
export const getRecentActivities = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId;
        const limit = parseInt(req.query.limit as string) || 10;
        if (!tenantId) {
            throw new AppError("Tenant ID is required", 400);
        }
        const activities = await DashboardService.getRecentActivities(tenantId, limit);
        res.json({
            status: "success",
            data: activities
        });
    } catch (error) {
        next(error);
    }
};
export const getTenantOverview = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId;
        if (!tenantId) {
            throw new AppError("Tenant ID is required", 400);
        }
        const overview = await DashboardService.getTenantOverview(tenantId);
        res.json({
            status: "success",
            data: overview
        });
    } catch (error) {
        next(error);
    }
};
