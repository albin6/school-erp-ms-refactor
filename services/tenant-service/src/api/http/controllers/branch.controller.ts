import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../../../domain/errors/AppError';
import { logger } from '../../../config/logger';
import { BranchRepository } from '../../../infrastructure/database/BranchRepository';

const createBranchSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Invalid slug format'),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email('Invalid email address').optional(),
});
const branchRepo = new BranchRepository();

export const getBranchesController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { tenantId } = req.params;
        logger.info(`Getting branches for tenant: ${tenantId}`);
        const branches = await branchRepo.listByTenant(tenantId);
        res.status(200).json({ success: true, data: branches });
    } catch (error) {
        next(error);
    }
};

export const createBranchController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { tenantId } = req.params;
        const body = createBranchSchema.parse(req.body);
        logger.info(`Creating branch for tenant: ${tenantId}`);
        const branch = await branchRepo.create({
            tenantId,
            name: body.name,
            slug: body.slug,
            address: body.address,
            phone: body.phone,
            email: body.email,
        });
        res.status(201).json({ success: true, data: branch });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
            return;
        }
        if ((error as { code?: string })?.code === '23505') {
            next(new AppError('Branch with this name or slug already exists', 409));
            return;
        }
        next(error);
    }
};

export const getBranchController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { tenantId } = req.params;
        const { branchId } = req.params;
        logger.info(`Getting branch: ${branchId}`);
        const branch = await branchRepo.findById(tenantId, branchId);
        if (!branch) {
            throw new AppError('Branch not found', 404);
        }
        res.status(200).json({ success: true, data: branch });
    } catch (error) {
        next(error);
    }
};
