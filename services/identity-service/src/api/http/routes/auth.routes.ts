import { Router } from 'express';
import { loginController } from '../controllers/auth.controller';
const router = Router();
router.post('/login', loginController);
export { router as authRoutes };
