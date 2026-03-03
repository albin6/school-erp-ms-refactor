import { Router } from 'express';
import { loginController, getMeController, logoutController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', loginController);
router.get('/me', requireAuth, getMeController);
router.post('/logout', requireAuth, logoutController);

// Placeholder routes for other auth features
router.post('/forgot-password', (req, res) => res.status(200).json({ success: true, message: 'Feature coming soon' }));
router.post('/reset-password', (req, res) => res.status(200).json({ success: true, message: 'Feature coming soon' }));
router.post('/verify-otp', (req, res) => res.status(200).json({ success: true, message: 'Feature coming soon' }));
router.post('/resend-otp', (req, res) => res.status(200).json({ success: true, message: 'Feature coming soon' }));
router.post('/logout-all', requireAuth, (req, res) => res.status(200).json({ success: true, message: 'Feature coming soon' }));

export { router as authRoutes };
