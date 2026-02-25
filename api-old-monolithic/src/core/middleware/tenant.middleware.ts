import { Request, Response, NextFunction } from 'express';
import { Tenant } from '../../infrastructure/database/models';
import { AppError } from '../utils/AppError';
export interface TenantRequest extends Request {
    tenant?: Tenant;
    tenantId?: string;
}
export const tenantContext = async (
    req: TenantRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const subdomain = req.headers['x-tenant-subdomain'] as string;
        if (!subdomain || subdomain === 'sadmin') {
            return next();
        }
        const tenant = await Tenant.findOne({
            where: {
                subdomain,
                is_active: true,
            },
        });
        if (!tenant) {
            throw new AppError('Tenant not found or inactive', 404);
        }
        if (tenant.status !== 'ACTIVE') {
            throw new AppError('Tenant is not active', 403);
        }
        req.tenant = tenant;
        req.tenantId = tenant.id;
        next();
    } catch (error) {
        next(error);
    }
};
export const requireTenant = (
    req: TenantRequest,
    res: Response,
    next: NextFunction
) => {
    if (!req.tenant || !req.tenantId) {
        throw new AppError('Tenant context is required', 400);
    }
    next();
};
