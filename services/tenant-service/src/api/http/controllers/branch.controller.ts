import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../../../domain/errors/AppError';
import { logger } from '../../../config/logger';
import { BranchRepository } from '../../../infrastructure/database/BranchRepository';
import { TenantRepository } from '../../../infrastructure/database/TenantRepository';

const createBranchSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Invalid slug format'),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email('Invalid email address').optional(),
});
const updateBranchSchema = z.object({
    name: z.string().min(1, 'Name is required').optional(),
    slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Invalid slug format').optional(),
    address: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().email('Invalid email address').nullable().optional(),
    status: z.enum(['ACTIVE', 'BLOCKED']).optional(),
});
const branchRepo = new BranchRepository();
const tenantRepo = new TenantRepository();

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

export const updateBranchController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { tenantId, branchId } = req.params;
        const body = updateBranchSchema.parse(req.body);
        const branch = await branchRepo.update(tenantId, branchId, {
            name: body.name?.trim(),
            slug: body.slug?.trim().toLowerCase(),
            address: body.address,
            phone: body.phone,
            email: body.email,
            status: body.status,
        });

        if (!branch) {
            throw new AppError('Branch not found', 404);
        }

        res.status(200).json({ success: true, data: branch });
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

export const deleteBranchController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { tenantId, branchId } = req.params;
        const branch = await branchRepo.findById(tenantId, branchId);
        if (!branch) {
            throw new AppError('Branch not found', 404);
        }

        const assignedUsers = await branchRepo.countMemberships(tenantId, branchId);
        if (assignedUsers > 0) {
            throw new AppError('Cannot delete a branch with assigned users. Move or delete those users first.', 409);
        }

        await branchRepo.delete(tenantId, branchId);
        res.status(200).json({ success: true, message: 'Branch deleted successfully' });
    } catch (error) {
        next(error);
    }
};

export const toggleBranchStatusController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { tenantId, branchId } = req.params;
        const branch = await branchRepo.findById(tenantId, branchId);
        if (!branch) {
            throw new AppError('Branch not found', 404);
        }

        const nextStatus = branch.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
        const updated = await branchRepo.update(tenantId, branchId, { status: nextStatus });
        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
};

export const getBranchBySlugController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { tenantId, slug } = req.params;
        const branch = await branchRepo.findBySlug(tenantId, slug);
        if (!branch) {
            throw new AppError('Branch not found', 404);
        }
        res.status(200).json({ success: true, data: branch });
    } catch (error) {
        next(error);
    }
};

export const getPublicBranchesController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const subdomain = typeof req.query.subdomain === 'string' ? req.query.subdomain.trim().toLowerCase() : '';
        const search = typeof req.query.search === 'string' ? req.query.search : undefined;

        if (!subdomain) {
            throw new AppError('Subdomain is required', 400);
        }

        const tenant = await tenantRepo.findBySubdomain(subdomain);
        if (!tenant) {
            throw new AppError('Tenant not found', 404);
        }

        logger.info(`Getting public branches for tenant subdomain: ${subdomain}`);
        const branches = await branchRepo.listPublicByTenant(tenant.id, search);
        res.status(200).json({ success: true, data: branches });
    } catch (error) {
        next(error);
    }
};

export const getPublicBranchBySlugController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const subdomain = typeof req.query.subdomain === 'string' ? req.query.subdomain.trim().toLowerCase() : '';
        const slug = typeof req.query.slug === 'string' ? req.query.slug.trim().toLowerCase() : '';

        if (!subdomain) {
            throw new AppError('Subdomain is required', 400);
        }
        if (!slug) {
            throw new AppError('Branch slug is required', 400);
        }

        const tenant = await tenantRepo.findBySubdomain(subdomain);
        if (!tenant) {
            throw new AppError('Tenant not found', 404);
        }

        logger.info(`Getting public branch '${slug}' for tenant subdomain: ${subdomain}`);
        const branch = await branchRepo.findPublicBySlug(tenant.id, slug);
        if (!branch) {
            throw new AppError('Branch not found', 404);
        }

        res.status(200).json({ success: true, data: branch });
    } catch (error) {
        next(error);
    }
};
