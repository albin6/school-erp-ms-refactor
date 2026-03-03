import { Request, Response, NextFunction } from 'express';
import { createTenantUseCase } from '../../../application/use-cases/createTenant.usecase';
import { z } from 'zod';
import { AppError } from '../../../domain/errors/AppError';
import { logger } from '../../../config/logger';

const createTenantSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    subdomain: z.string().regex(/^[a-z0-9-]+$/, 'Invalid subdomain format'),
    domain: z.string().optional(),
    adminEmail: z.string().email('Invalid email address'),
});

export const createTenantController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const body = createTenantSchema.parse(req.body);
        const userId = (req as any).user?.userId;
        const correlationId = req.headers['x-correlation-id'] as string;
        const result = await createTenantUseCase({
            name: body.name,
            subdomain: body.subdomain,
            domain: body.domain,
            adminEmail: body.adminEmail,
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

        // Placeholder implementation
        res.status(200).json({
            success: true,
            data: {
                tenants: [],
                pagination: {
                    total: 0,
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
        res.status(200).json({ success: true, data: { id, name: 'Placeholder Tenant' } });
    } catch (error) {
        next(error);
    }
};

export const updateTenantController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        logger.info(`Updating tenant: ${id}`);
        res.status(200).json({ success: true, data: { id, ...req.body } });
    } catch (error) {
        next(error);
    }
};

export const toggleTenantStatusController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const action = req.path.endsWith('block') ? 'blocked' : 'unblocked';
        logger.info(`Tenant ${id} ${action}`);
        res.status(200).json({ success: true, message: `Tenant ${action} successfully` });
    } catch (error) {
        next(error);
    }
};

export const deleteTenantController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        logger.info(`Deleting tenant: ${id}`);
        res.status(200).json({ success: true, message: 'Tenant deleted successfully' });
    } catch (error) {
        next(error);
    }
};

export const checkAvailabilityController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { subdomain } = req.query;
        logger.info(`Checking availability for: ${subdomain}`);
        res.status(200).json({ success: true, available: true });
    } catch (error) {
        next(error);
    }
};
