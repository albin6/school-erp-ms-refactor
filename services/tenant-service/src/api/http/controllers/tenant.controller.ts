import { Request, Response, NextFunction } from 'express';
import { createTenantUseCase } from '../../../application/use-cases/createTenant.usecase';
import { z } from 'zod';
import { AppError } from '../../../domain/errors/AppError';
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
