import { Router } from 'express';
import * as PasswordResetOTPController from '../controllers/password-reset-otp.controller';
import { rateLimit } from '../../../core/middleware/rate-limit.middleware';
const router = Router();
const otpRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: 'Too many OTP requests. Please try again later.',
    keyGenerator: (req) => req.body.email || req.ip || 'unknown'
});
const otpResendLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 1,
    message: 'Please wait before requesting another OTP.',
    keyGenerator: (req) => req.body.email || req.ip || 'unknown'
});
const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many verification attempts. Please try again later.',
    keyGenerator: (req) => req.body.email || req.ip || 'unknown'
});
router.post('/forgot-password', otpRequestLimiter, PasswordResetOTPController.requestPasswordResetOTP);
router.post('/verify-otp', otpVerifyLimiter, PasswordResetOTPController.verifyOTP);
router.post('/reset-password', PasswordResetOTPController.resetPassword);
router.post('/resend-otp', otpResendLimiter, PasswordResetOTPController.resendOTP);
router.get('/otp-status/:email', PasswordResetOTPController.getOTPStatus);
export default router;
