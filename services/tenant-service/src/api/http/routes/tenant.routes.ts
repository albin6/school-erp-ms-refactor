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
import { getBranchesController, createBranchController, getBranchController } from '../controllers/branch.controller';
import { getTenantUsersController, createTenantUserController } from '../controllers/tenant-user.controller';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.get('/check-availability', checkAvailabilityController);

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

// Tenant User management
router.get('/:tenantId/users', getTenantUsersController);
router.post('/:tenantId/users', createTenantUserController);

export { router as tenantRoutes };
