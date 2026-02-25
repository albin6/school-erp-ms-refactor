import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../core/utils/AppError';
import { OTPService } from '../../../core/security/otp.service';
import { emailService } from '../../../core/services/email.service';
import { User } from '../../../infrastructure/database/models';
import * as PasswordService from '../../../core/security/password.service';
export const requestPasswordResetOTP = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email } = req.body;
        if (!email) {
            throw new AppError('Email is required', 400);
        }
        const user = await User.findOne({ where: { email } });
        if (user) {
            const ipAddress = req.ip || req.socket.remoteAddress || null;
            const { otp, expiresAt } = await OTPService.createPasswordResetOTP(email, ipAddress);
            console.log(`[OTP DEBUG] OTP for ${email}: ${otp}`);
            await emailService.sendOTPEmail(email, otp, expiresAt);
            res.json({
                status: 'success',
                message: 'If an account exists with this email, an OTP has been sent',
                data: {
                    expiresAt: expiresAt.toISOString(),
                    cooldownSeconds: 60
                }
            });
        } else {
            await new Promise(resolve => setTimeout(resolve, 500));
            res.json({
                status: 'success',
                message: 'If an account exists with this email, an OTP has been sent',
                data: {
                    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
                    cooldownSeconds: 60
                }
            });
        }
    } catch (error) {
        next(error);
    }
};
export const verifyOTP = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            throw new AppError('Email and OTP are required', 400);
        }
        const result = await OTPService.validateOTP(email, otp);
        if (!result.valid) {
            throw new AppError(result.message, 400);
        }
        res.json({
            status: 'success',
            message: result.message,
            data: {
                resetToken: result.resetToken
            }
        });
    } catch (error) {
        next(error);
    }
};
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, resetToken, newPassword } = req.body;
        if (!email || !resetToken || !newPassword) {
            throw new AppError('Email, reset token, and new password are required', 400);
        }
        const isValidToken = await OTPService.validateResetToken(email, resetToken);
        if (!isValidToken) {
            throw new AppError('Invalid or expired reset token', 400);
        }
        const user = await User.findOne({ where: { email } });
        if (!user) {
            throw new AppError('User not found', 404);
        }
        const passwordHash = await PasswordService.hashPassword(newPassword);
        user.password_hash = passwordHash;
        user.failed_login_attempts = 0;
        user.lockout_until = null;
        await user.save();
        await emailService.sendPasswordResetConfirmation(email, 'School Management');
        const { TenantUser, Branch } = require("../../../infrastructure/database/models");
        const tenantUser = await TenantUser.findOne({
            where: { user_id: user.id },
            include: [
                {
                    model: Branch,
                    as: 'branch',
                    attributes: ['slug']
                }
            ]
        });
        res.json({
            status: 'success',
            message: 'Password reset successfully',
            data: {
                role: tenantUser?.role,
                sub_role: tenantUser?.sub_role,
                branch_slug: tenantUser?.branch?.slug
            }
        });
    } catch (error) {
        next(error);
    }
};
export const resendOTP = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email } = req.body;
        if (!email) {
            throw new AppError('Email is required', 400);
        }
        const user = await User.findOne({ where: { email } });
        if (user) {
            const ipAddress = req.ip || req.socket.remoteAddress || null;
            const { otp, expiresAt } = await OTPService.createPasswordResetOTP(email, ipAddress);
            console.log(`[OTP DEBUG] OTP for ${email}: ${otp}`);
            await emailService.sendOTPEmail(email, otp, expiresAt);
            res.json({
                status: 'success',
                message: 'New OTP sent successfully',
                data: {
                    expiresAt: expiresAt.toISOString(),
                    cooldownSeconds: 60
                }
            });
        } else {
            await new Promise(resolve => setTimeout(resolve, 500));
            res.json({
                status: 'success',
                message: 'New OTP sent successfully',
                data: {
                    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
                    cooldownSeconds: 60
                }
            });
        }
    } catch (error) {
        next(error);
    }
};
export const getOTPStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const email = req.params.email as string;
        if (!email) {
            throw new AppError('Email is required', 400);
        }
        const status = await OTPService.getOTPStatus(email);
        res.json({
            status: 'success',
            data: status
        });
    } catch (error) {
        next(error);
    }
};
