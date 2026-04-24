import { Request, Response, NextFunction } from 'express';
import { createTenantUseCase } from '../../../application/use-cases/createTenant.usecase';
import { z } from 'zod';
import { AppError } from '../../../domain/errors/AppError';
import { logger } from '../../../config/logger';
import { TenantRepository } from '../../../infrastructure/database/TenantRepository';

const createTenantSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    subdomain: z.string().regex(/^[a-z0-9-]+$/, 'Invalid subdomain format'),
    domain: z.string().optional(),
    adminEmail: z.string().email('Invalid email address').optional(),
    admin_email: z.string().email('Invalid email address').optional(),
}).refine((data) => Boolean(data.adminEmail || data.admin_email), {
    message: 'Required',
    path: ['adminEmail'],
});
const updateTenantSchema = z.object({
    name: z.string().min(1).optional(),
    subdomain: z.string().regex(/^[a-z0-9-]+$/, 'Invalid subdomain format').optional(),
    domain: z.string().nullable().optional(),
    settings: z.record(z.any()).optional(),
});
const tenantRepo = new TenantRepository();

export const createTenantController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const body = createTenantSchema.parse(req.body);
        const adminEmail = body.adminEmail ?? body.admin_email!;
        const userId = (req as any).user?.userId;
        const correlationId = req.headers['x-correlation-id'] as string;
        const result = await createTenantUseCase({
            name: body.name,
            subdomain: body.subdomain,
            domain: body.domain,
            adminEmail,
            createdBy: userId,
            correlationId,
        });
        res.status(201).json({
            success: true,
            data: { tenantId: result.tenantId },
            message: 'Tenant provisioned successfully. Background setup initiated.',
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
            return;
        }
        next(error);
    }
};
export const getTenantsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        logger.info('Getting all tenants');
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const { tenants, total } = await tenantRepo.listPaginated(page, limit);
        res.status(200).json({
            success: true,
            data: {
                tenants: tenants.map((tenant) => ({
                    id: tenant.id,
                    name: tenant.name,
                    subdomain: tenant.subdomain,
                    domain: tenant.domain,
                    status: tenant.status,
                    is_active: tenant.isActive,
                    created_at: tenant.createdAt,
                    updated_at: tenant.updatedAt,
                })),
                pagination: {
                    total,
                    current: page,
                    pageSize: limit
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getTenantByIdController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        logger.info(`Getting tenant: ${id}`);
        const tenant = await tenantRepo.findById(id);
        if (!tenant) {
            throw new AppError('Tenant not found', 404);
        }
        res.status(200).json({
            success: true,
            data: {
                id: tenant.id,
                name: tenant.name,
                subdomain: tenant.subdomain,
                domain: tenant.domain,
                status: tenant.status,
                is_active: tenant.isActive,
                settings: tenant.settings,
                created_at: tenant.createdAt,
                updated_at: tenant.updatedAt,
            }
        });
    } catch (error) {
        next(error);
    }
};

export const updateTenantController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        logger.info(`Updating tenant: ${id}`);
        const body = updateTenantSchema.parse(req.body);
        const tenant = await tenantRepo.findById(id);
        if (!tenant) {
            throw new AppError('Tenant not found', 404);
        }
        if (body.subdomain && body.subdomain !== tenant.subdomain) {
            const existing = await tenantRepo.findByAnySubdomain(body.subdomain);
            if (existing && existing.id !== tenant.id) {
                throw new AppError('Tenant with this subdomain already exists', 409);
            }
            tenant.subdomain = body.subdomain;
        }
        if (typeof body.name === 'string') {
            tenant.name = body.name.trim();
        }
        if (body.domain !== undefined) {
            tenant.domain = body.domain;
        }
        if (body.settings) {
            tenant.updateSettings(body.settings);
        }
        const updatedTenant = await tenantRepo.update(tenant);
        res.status(200).json({
            success: true,
            data: {
                id: updatedTenant.id,
                name: updatedTenant.name,
                subdomain: updatedTenant.subdomain,
                domain: updatedTenant.domain,
                status: updatedTenant.status,
                is_active: updatedTenant.isActive,
                settings: updatedTenant.settings,
                created_at: updatedTenant.createdAt,
                updated_at: updatedTenant.updatedAt,
            }
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
            return;
        }
        next(error);
    }
};

export const toggleTenantStatusController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const action = req.path.endsWith('block') ? 'blocked' : 'unblocked';
        const tenant = await tenantRepo.findById(id);
        if (!tenant) {
            throw new AppError('Tenant not found', 404);
        }
        if (action === 'blocked') {
            tenant.suspend();
        } else {
            tenant.activate();
        }
        await tenantRepo.update(tenant);
        logger.info(`Tenant ${id} ${action}`);
        res.status(200).json({ success: true, message: `Tenant ${action} successfully` });
    } catch (error) {
        next(error);
    }
};

export const deleteTenantController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const tenant = await tenantRepo.findById(id);
        if (!tenant) {
            throw new AppError('Tenant not found', 404);
        }
        logger.info(`Deleting tenant: ${id}`);
        await tenantRepo.delete(id);
        res.status(200).json({ success: true, message: 'Tenant deleted successfully' });
    } catch (error) {
        next(error);
    }
};

export const checkAvailabilityController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { subdomain } = req.query;
        logger.info(`Checking availability for: ${subdomain}`);
        const candidate = typeof subdomain === 'string' ? subdomain.trim().toLowerCase() : '';
        if (!candidate) {
            throw new AppError('Subdomain is required', 400);
        }
        const exists = await tenantRepo.existsBySubdomain(candidate);
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
            'Surrogate-Control': 'no-store',
            ETag: `"tenant-availability-${candidate}-${Date.now()}"`,
        });
        res.status(200).json({ success: true, available: !exists });
    } catch (error) {
        next(error);
    }
};
