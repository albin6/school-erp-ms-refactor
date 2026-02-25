import { Router } from 'express';
import { createTenantController } from '../controllers/tenant.controller';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.middleware';
const router = Router();
router.use(requireAuth);
router.post('/', requireSuperAdmin, createTenantController);
export { router as tenantRoutes };
