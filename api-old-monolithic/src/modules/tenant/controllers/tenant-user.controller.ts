import { Request, Response, NextFunction } from "express";
import { TenantUserService } from "../services/tenant-user.service";
import type { TenantRequest } from "../../../core/middleware/tenant.middleware";
const getParam = (param: string | string[]) => Array.isArray(param) ? param[0] : param;
export const createUser = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = getParam(req.params.tenantId);
        const user = await TenantUserService.createUser(tenantId, req.body);
        res.status(201).json({
            status: "success",
            data: user
        });
    } catch (error) {
        next(error);
    }
};
export const getUsers = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = getParam(req.params.tenantId);
        const { page, limit, search, role, sub_role, branch_id, status, sortBy, sortOrder } = req.query;
        const result = await TenantUserService.getUsers(tenantId, {
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 10,
            search: search as string,
            role: role as string,
            sub_role: sub_role as string,
            branch_id: branch_id as string,
            status: status as 'ACTIVE' | 'BLOCKED',
            sortBy: sortBy as string,
            sortOrder: sortOrder as 'ASC' | 'DESC'
        });
        res.status(200).json({
            status: "success",
            data: result
        });
    } catch (error) {
        next(error);
    }
};
export const updateUser = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = getParam(req.params.tenantId);
        const userId = getParam(req.params.userId);
        const user = await TenantUserService.updateUser(tenantId, userId, req.body);
        res.status(200).json({
            status: "success",
            data: user
        });
    } catch (error) {
        next(error);
    }
};
export const deleteUser = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = getParam(req.params.tenantId);
        const userId = getParam(req.params.userId);
        await TenantUserService.deleteUser(tenantId, userId);
        res.status(200).json({
            status: "success",
            message: "User deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};
