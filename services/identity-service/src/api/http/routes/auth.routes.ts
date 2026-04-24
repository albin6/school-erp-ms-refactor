import { Router } from 'express';
import {
    loginController,
    getMeController,
    logoutController,
    refreshController,
    forgotPasswordController,
    resetPasswordController,
    verifyOtpController,
    resendOtpController,
    tenantResetPasswordController,
    tenantAdminLoginController,
    tenantStaffLoginController,
    tenantStudentLoginController,
    tenantGetMeController,
    tenantRefreshController,
    tenantLogoutController,
} from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', loginController);
router.post('/refresh', refreshController);
router.get('/me', requireAuth, getMeController);
router.post('/logout', requireAuth, logoutController);
router.post('/tenant/:tenantId/admin/login', tenantAdminLoginController);
router.post('/tenant/:tenantId/staff/login', tenantStaffLoginController);
router.post('/tenant/:tenantId/student/login', tenantStudentLoginController);
router.post('/tenant/:tenantId/refresh', tenantRefreshController);
router.get('/tenant/:tenantId/me', requireAuth, tenantGetMeController);
router.post('/tenant/:tenantId/logout', requireAuth, tenantLogoutController);
router.post('/tenant/:tenantId/reset-password', requireAuth, tenantResetPasswordController);
router.post('/forgot-password', forgotPasswordController);
router.post('/reset-password', resetPasswordController);
router.post('/verify-otp', verifyOtpController);
router.post('/resend-otp', resendOtpController);
router.post('/logout-all', requireAuth, (req, res) => res.status(200).json({ success: true, message: 'Feature coming soon' }));

export { router as authRoutes };
