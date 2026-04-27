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
    getPublicBranchBySlugController,
    updateBranchController,
    deleteBranchController,
    toggleBranchStatusController,
    getBranchBySlugController
} from '../controllers/branch.controller';
import {
    getTenantUsersController,
    createTenantUserController,
    updateTenantUserController,
    deleteTenantUserController
} from '../controllers/tenant-user.controller';
import { getDashboardStatsController, getDashboardActivitiesController } from '../controllers/dashboard.controller';
import { requireAuth, requireSuperAdmin, requireTenantAccess } from '../middleware/auth.middleware';

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
tenantScopedRouter.get('/branches/slug/:slug', getBranchBySlugController);

tenantAdminRouter.post('/branches', createBranchController);
tenantAdminRouter.patch('/branches/:branchId', updateBranchController);
tenantAdminRouter.delete('/branches/:branchId', deleteBranchController);
tenantAdminRouter.patch('/branches/:branchId/status', toggleBranchStatusController);

// Tenant User management
tenantAdminRouter.get('/users', getTenantUsersController);
tenantAdminRouter.post('/users', createTenantUserController);
tenantAdminRouter.patch('/users/:userId', updateTenantUserController);
tenantAdminRouter.delete('/users/:userId', deleteTenantUserController);

// Tenant dashboard
tenantAdminRouter.get('/dashboard/stats', getDashboardStatsController);
tenantAdminRouter.get('/dashboard/activities', getDashboardActivitiesController);

router.use('/:tenantId', tenantAdminRouter);
router.use('/:tenantId', tenantScopedRouter);

export { router as tenantRoutes };
