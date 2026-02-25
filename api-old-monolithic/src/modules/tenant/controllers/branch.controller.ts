import { Request, Response, NextFunction } from "express";
import { BranchService } from "../services/branch.service";
import type { TenantRequest } from "../../../core/middleware/tenant.middleware";
const getParam = (param: string | string[]) => Array.isArray(param) ? param[0] : param;
export const createBranch = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = getParam(req.params.tenantId);
        const branch = await BranchService.createBranch(tenantId, req.body);
        res.status(201).json({
            status: "success",
            data: branch
        });
    } catch (error) {
        next(error);
    }
};
export const getBranches = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = getParam(req.params.tenantId);
        const { page, limit, search, status, sortBy, sortOrder } = req.query;
        const result = await BranchService.getBranches(tenantId, {
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 10,
            search: search as string,
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
export const getBranch = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = getParam(req.params.tenantId);
        const branchId = getParam(req.params.branchId);
        const branch = await BranchService.getBranch(tenantId, branchId);
        res.status(200).json({
            status: "success",
            data: branch
        });
    } catch (error) {
        next(error);
    }
};
export const updateBranch = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = getParam(req.params.tenantId);
        const branchId = getParam(req.params.branchId);
        const branch = await BranchService.updateBranch(tenantId, branchId, req.body);
        res.status(200).json({
            status: "success",
            data: branch
        });
    } catch (error) {
        next(error);
    }
};
export const deleteBranch = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = getParam(req.params.tenantId);
        const branchId = getParam(req.params.branchId);
        await BranchService.deleteBranch(tenantId, branchId);
        res.status(200).json({
            status: "success",
            message: "Branch deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};
export const toggleBlockStatus = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = getParam(req.params.tenantId);
        const branchId = getParam(req.params.branchId);
        const branch = await BranchService.toggleBlock(tenantId, branchId);
        res.status(200).json({
            status: "success",
            data: branch,
            message: `Branch ${branch.status.toLowerCase()} successfully`
        });
    } catch (error) {
        next(error);
    }
};
export const checkSlug = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = getParam(req.params.tenantId);
        const { slug } = req.query;
        if (!slug || typeof slug !== 'string') {
            res.status(400).json({
                status: "error",
                message: "Slug is required"
            });
            return;
        }
        const isAvailable = await BranchService.checkSlugAvailability(tenantId, slug);
        res.status(200).json({
            status: "success",
            data: { isAvailable }
        });
    } catch (error) {
        next(error);
    }
};
export const getBranchBySlug = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = getParam(req.params.tenantId);
        const slug = getParam(req.params.slug);
        const branch = await BranchService.getBranchBySlug(tenantId, slug);
        res.status(200).json({
            status: "success",
            data: branch
        });
    } catch (error) {
        next(error);
    }
};
export const getPublicBranches = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { subdomain, search } = req.query;
        if (!subdomain || typeof subdomain !== 'string') {
            res.status(400).json({
                status: "error",
                message: "Subdomain is required"
            });
            return;
        }
        const branches = await BranchService.getPublicBranches(subdomain, search as string);
        res.status(200).json({
            status: "success",
            data: branches
        });
    } catch (error) {
        next(error);
    }
};
export const getPublicBranchBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { subdomain, slug } = req.query;
        if (!subdomain || typeof subdomain !== 'string') {
            res.status(400).json({ status: "error", message: "Subdomain is required" });
            return;
        }
        if (!slug || typeof slug !== 'string') {
            res.status(400).json({ status: "error", message: "Slug is required" });
            return;
        }
        const branch = await BranchService.getPublicBranchBySlug(subdomain, slug);
        res.status(200).json({
            status: "success",
            data: branch
        });
    } catch (error) {
        next(error);
    }
};
