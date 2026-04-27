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
import { getDashboardStatsController, getDashboardActivitiesController } from '../controllers/dashboard.controller';
import { requireAuth, requireSuperAdmin, requireTenantAccess } from '../middleware/auth.middleware';
import { AppError } from '../../../domain/errors/AppError';

const router = Router();
const tenantScopedRouter = Router({ mergeParams: true });
const tenantAdminRouter = Router({ mergeParams: true });

// Public routes
router.get('/check-availability', checkAvailabilityController);
router.get('/public/branches', getPublicBranchesController);
router.get('/public/branches/slug', getPublicBranchBySlugController);

router.use(requireAuth);
tenantScopedRouter.use(requireTenantAccess());
tenantAdminRouter.use(requireTenantAccess(['ADMIN']));

// Tenant management (Super Admin only for list/create/delete/block)
router.get('/', requireSuperAdmin, getTenantsController);
router.post('/', requireSuperAdmin, createTenantController);
router.get('/:id', requireTenantAccess(), getTenantByIdController);
router.put('/:id', requireSuperAdmin, updateTenantController);
router.delete('/:id', requireSuperAdmin, deleteTenantController);
router.patch('/:id/block', requireSuperAdmin, toggleTenantStatusController);
router.patch('/:id/unblock', requireSuperAdmin, toggleTenantStatusController);

// Branch management
tenantScopedRouter.get('/branches', getBranchesController);
tenantScopedRouter.get('/branches/:branchId', getBranchController);
tenantScopedRouter.get('/branches/slug/:slug', (_req, _res, next) => next(new AppError('Feature not implemented yet', 501)));

tenantAdminRouter.post('/branches', createBranchController);
tenantAdminRouter.patch('/branches/:branchId', (_req, _res, next) => next(new AppError('Feature not implemented yet', 501)));
tenantAdminRouter.delete('/branches/:branchId', (_req, _res, next) => next(new AppError('Feature not implemented yet', 501)));
tenantAdminRouter.patch('/branches/:branchId/status', (_req, _res, next) => next(new AppError('Feature not implemented yet', 501)));

// Tenant User management
tenantAdminRouter.get('/users', getTenantUsersController);
tenantAdminRouter.post('/users', createTenantUserController);
tenantAdminRouter.patch('/users/:userId', (_req, _res, next) => next(new AppError('Feature not implemented yet', 501)));
tenantAdminRouter.delete('/users/:userId', (_req, _res, next) => next(new AppError('Feature not implemented yet', 501)));

// Tenant dashboard
tenantAdminRouter.get('/dashboard/stats', getDashboardStatsController);
tenantAdminRouter.get('/dashboard/activities', getDashboardActivitiesController);

router.use('/:tenantId', tenantAdminRouter);
router.use('/:tenantId', tenantScopedRouter);

export { router as tenantRoutes };
