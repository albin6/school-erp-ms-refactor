import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { AppError } from "../../../core/utils/AppError";
import { z } from "zod";
import type { TenantRequest } from "../../../core/middleware/tenant.middleware";
import { emailService } from "../../../core/services/email.service";
const PasswordResetSchema = z.object({
    email: z.string().email(),
    oldPassword: z.string().min(1),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});
const CheckResetRequiredSchema = z.object({
    email: z.string().email(),
});
export const resetPassword = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId;
        const data = PasswordResetSchema.parse(req.body);
        const { User, TenantUser } = require("../../../infrastructure/database/models");
        const { verifyPassword, hashPassword } = require("../../../core/security/password.service");
        const { validatePasswordStrength } = require("../../../core/utils/password.utils");
        if (!tenantId) {
            throw new AppError("Tenant ID is required", 400);
        }
        if (!validatePasswordStrength(data.newPassword)) {
            throw new AppError("Password must contain uppercase, lowercase, number, and symbol", 400);
        }
        const user = await User.findOne({ where: { email: data.email } });
        if (!user) {
            throw new AppError("Invalid credentials", 401);
        }
        const isMatch = await verifyPassword(data.oldPassword, user.password_hash);
        if (!isMatch) {
            throw new AppError("Invalid credentials", 401);
        }
        const tenantUser = await TenantUser.findOne({
            where: {
                user_id: user.id,
                tenant_id: tenantId
            }
        });
        if (!tenantUser) {
            throw new AppError("User not found in this tenant", 403);
        }
        const newPasswordHash = await hashPassword(data.newPassword);
        await user.update({
            password_hash: newPasswordHash,
            must_reset_password: false,
            password_reset_token: null,
            password_reset_expires: null,
        });
        try {
            const { Tenant } = require("../../../infrastructure/database/models");
            const tenant = await Tenant.findByPk(tenantId);
            if (tenant) {
                await emailService.sendPasswordResetConfirmation(data.email, tenant.name);
            }
        } catch (emailError) {
            console.error('Failed to send confirmation email:', emailError);
        }
        res.json({
            status: "success",
            message: "Password reset successfully"
        });
    } catch (error) {
        next(error);
    }
};
export const checkResetRequired = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId;
        const data = CheckResetRequiredSchema.parse(req.body);
        const { User, TenantUser } = require("../../../infrastructure/database/models");
        if (!tenantId) {
            throw new AppError("Tenant ID is required", 400);
        }
        const user = await User.findOne({ where: { email: data.email } });
        if (!user) {
            throw new AppError("User not found", 404);
        }
        const tenantUser = await TenantUser.findOne({
            where: {
                user_id: user.id,
                tenant_id: tenantId
            }
        });
        if (!tenantUser) {
            throw new AppError("User not found in this tenant", 403);
        }
        res.json({
            status: "success",
            data: {
                mustResetPassword: user.must_reset_password
            }
        });
    } catch (error) {
        next(error);
    }
};
