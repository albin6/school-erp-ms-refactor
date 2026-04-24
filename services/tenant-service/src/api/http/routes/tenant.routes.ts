import { Router } from 'express';
import {
    createTenantController,
    getTenantsController,
    getTenantByIdController,
    updateTenantController,
    deleteTenantController,
    toggleTenantStatusController,
    checkAvailabilityController
} from '../controllers/tenant.controller';
import {
    getBranchesController,
    createBranchController,
    getBranchController,
    getPublicBranchesController,
    getPublicBranchBySlugController
} from '../controllers/branch.controller';
import { getTenantUsersController, createTenantUserController } from '../controllers/tenant-user.controller';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.middleware';
import { AppError } from '../../../domain/errors/AppError';

const router = Router();

// Public routes
router.get('/check-availability', checkAvailabilityController);
router.get('/public/branches', getPublicBranchesController);
router.get('/public/branches/slug', getPublicBranchBySlugController);

router.use(requireAuth);

// Tenant management (Super Admin only for list/create/delete/block)
router.get('/', requireSuperAdmin, getTenantsController);
router.post('/', requireSuperAdmin, createTenantController);
router.get('/:id', getTenantByIdController);
router.put('/:id', requireSuperAdmin, updateTenantController);
router.delete('/:id', requireSuperAdmin, deleteTenantController);
router.patch('/:id/block', requireSuperAdmin, toggleTenantStatusController);
router.patch('/:id/unblock', requireSuperAdmin, toggleTenantStatusController);

// Branch management
router.get('/:tenantId/branches', getBranchesController);
router.post('/:tenantId/branches', createBranchController);
router.get('/:tenantId/branches/:branchId', getBranchController);
router.patch('/:tenantId/branches/:branchId', (_req, _res, next) => next(new AppError('Feature not implemented yet', 501)));
router.delete('/:tenantId/branches/:branchId', (_req, _res, next) => next(new AppError('Feature not implemented yet', 501)));
router.patch('/:tenantId/branches/:branchId/status', (_req, _res, next) => next(new AppError('Feature not implemented yet', 501)));
router.get('/:tenantId/branches/slug/:slug', (_req, _res, next) => next(new AppError('Feature not implemented yet', 501)));

// Tenant User management
router.get('/:tenantId/users', getTenantUsersController);
router.post('/:tenantId/users', createTenantUserController);
router.patch('/:tenantId/users/:userId', (_req, _res, next) => next(new AppError('Feature not implemented yet', 501)));
router.delete('/:tenantId/users/:userId', (_req, _res, next) => next(new AppError('Feature not implemented yet', 501)));

export { router as tenantRoutes };
