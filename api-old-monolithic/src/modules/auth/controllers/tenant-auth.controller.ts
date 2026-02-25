import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { TenantLoginSchema } from "../dtos/tenant-auth.schema";
import { AppError } from "../../../core/utils/AppError";
import type { TenantRequest } from "../../../core/middleware/tenant.middleware";
export const tenantAdminLogin = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantSubdomain = Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId;
        const data = TenantLoginSchema.parse(req.body);
        if (!tenantSubdomain) {
            throw new AppError("Tenant subdomain is required", 400);
        }
        const { Tenant } = require("../../../infrastructure/database/models");
        const tenant = await Tenant.findOne({ where: { subdomain: tenantSubdomain } });
        if (!tenant) {
            throw new AppError("Tenant not found", 404);
        }
        const result = await AuthService.loginWithTenantContext(
            data.email,
            data.password,
            tenant.id,
            'ADMIN',
            req.ip || 'unknown',
            req.headers['user-agent'] || 'unknown'
        );
        res.cookie('accessToken', result.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000
        });
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.json({
            status: "success",
            data: {
                user: result.user,
                tenant: result.tenant,
                accessToken: result.accessToken
            }
        });
    } catch (error) {
        next(error);
    }
};
export const tenantStaffLogin = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantSubdomain = Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId;
        const data = TenantLoginSchema.parse(req.body);
        if (!tenantSubdomain) {
            throw new AppError("Tenant subdomain is required", 400);
        }
        const { Tenant } = require("../../../infrastructure/database/models");
        const tenant = await Tenant.findOne({ where: { subdomain: tenantSubdomain } });
        if (!tenant) {
            throw new AppError("Tenant not found", 404);
        }
        const result = await AuthService.loginWithTenantContext(
            data.email,
            data.password,
            tenant.id,
            'STAFF',
            req.ip || 'unknown',
            req.headers['user-agent'] || 'unknown'
        );
        res.cookie('accessToken', result.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000
        });
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.json({
            status: "success",
            data: {
                user: result.user,
                tenant: result.tenant,
                accessToken: result.accessToken
            }
        });
    } catch (error) {
        next(error);
    }
};
export const tenantStudentLogin = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantSubdomain = Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId;
        const data = TenantLoginSchema.parse(req.body);
        if (!tenantSubdomain) {
            throw new AppError("Tenant subdomain is required", 400);
        }
        const { Tenant } = require("../../../infrastructure/database/models");
        const tenant = await Tenant.findOne({ where: { subdomain: tenantSubdomain } });
        if (!tenant) {
            throw new AppError("Tenant not found", 404);
        }
        const result = await AuthService.loginWithTenantContext(
            data.email,
            data.password,
            tenant.id,
            'STUDENT',
            req.ip || 'unknown',
            req.headers['user-agent'] || 'unknown'
        );
        res.cookie('accessToken', result.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000
        });
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.json({
            status: "success",
            data: {
                user: result.user,
                tenant: result.tenant,
                accessToken: result.accessToken
            }
        });
    } catch (error) {
        next(error);
    }
};
export const tenantRefresh = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantSubdomain = Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId;
        if (!tenantSubdomain) {
            throw new AppError("Tenant subdomain is required", 400);
        }
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            throw new AppError("No refresh token provided", 401);
        }
        const result = await AuthService.refreshToken(
            refreshToken,
            req.ip || 'unknown'
        );
        res.cookie('accessToken', result.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000
        });
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.json({
            status: "success",
            data: {
                accessToken: result.accessToken
            }
        });
    } catch (error) {
        next(error);
    }
};
export const getTenantMe = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;
        if (!user) {
            throw new AppError("Not authenticated", 401);
        }
        res.json({
            status: "success",
            data: { user }
        });
    } catch (error) {
        next(error);
    }
};
