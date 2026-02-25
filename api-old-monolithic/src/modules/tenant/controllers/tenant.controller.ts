import { Request, Response, NextFunction } from "express";
import { TenantService } from "../services/tenant.service";
import { CreateTenantSchema, UpdateTenantSchema, TenantQuerySchema } from "../dtos/tenant.schema";
import { AppError } from "../../../core/utils/AppError";
const getQueryParam = (value: any): string | undefined => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && value.length > 0) return String(value[0]);
    return undefined;
};
const getParam = (value: string | string[]): string => {
    return Array.isArray(value) ? value[0] : value;
};
export const checkAvailability = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const subdomain = getQueryParam(req.query.subdomain);
        const excludeId = getQueryParam(req.query.excludeId);
        if (!subdomain) {
            throw new AppError("Subdomain is required", 400);
        }
        const result = await TenantService.checkAvailability(subdomain, excludeId);
        res.json({
            status: "success",
            data: result,
        });
    } catch (error) {
        next(error);
    }
};
export const createTenant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = CreateTenantSchema.parse(req.body);
        const userId = (req as any).user?.userId;
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const tenant = await TenantService.createTenant(data, userId);
        res.status(201).json({
            status: "success",
            data: { tenant },
        });
    } catch (error) {
        next(error);
    }
};
export const getTenants = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = TenantQuerySchema.parse(req.query);
        const result = await TenantService.getTenants(query);
        res.json({
            status: "success",
            data: result,
        });
    } catch (error) {
        next(error);
    }
};
export const getTenantById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = getParam(req.params.id);
        const tenant = await TenantService.getTenantById(id);
        res.json({
            status: "success",
            data: { tenant },
        });
    } catch (error) {
        next(error);
    }
};
export const updateTenant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = getParam(req.params.id);
        const data = UpdateTenantSchema.parse(req.body);
        const tenant = await TenantService.updateTenant(id, data);
        res.json({
            status: "success",
            data: { tenant },
        });
    } catch (error) {
        next(error);
    }
};
export const deleteTenant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = getParam(req.params.id);
        const result = await TenantService.deleteTenant(id);
        res.json({
            status: "success",
            ...result,
        });
    } catch (error) {
        next(error);
    }
};
export const blockTenant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = getParam(req.params.id);
        const result = await TenantService.blockTenant(id);
        res.json({
            status: "success",
            ...result,
        });
    } catch (error) {
        next(error);
    }
};
export const unblockTenant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = getParam(req.params.id);
        const result = await TenantService.unblockTenant(id);
        res.json({
            status: "success",
            ...result,
        });
    } catch (error) {
        next(error);
    }
};
export const getTenantUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = getParam(req.params.id);
        const query = {
            page: parseInt(getQueryParam(req.query.page) || '1', 10),
            limit: parseInt(getQueryParam(req.query.limit) || '10', 10),
            role: getQueryParam(req.query.role),
        };
        const result = await TenantService.getTenantUsers(id, query);
        res.json({
            status: "success",
            data: result,
        });
    } catch (error) {
        next(error);
    }
};
