import { Router } from 'express';
import { createTenantController } from '../controllers/tenant.controller';
import { getBranchesController, createBranchController, getBranchController } from '../controllers/branch.controller';
import { getTenantUsersController, createTenantUserController } from '../controllers/tenant-user.controller';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

// Tenant management (Super Admin only)
router.post('/', requireSuperAdmin, createTenantController);

// Branch management
router.get('/:tenantId/branches', getBranchesController);
router.post('/:tenantId/branches', createBranchController);
router.get('/:tenantId/branches/:branchId', getBranchController);

// Tenant User management
router.get('/:tenantId/users', getTenantUsersController);
router.post('/:tenantId/users', createTenantUserController);

export { router as tenantRoutes };
