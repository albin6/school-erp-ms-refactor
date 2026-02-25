import { Response, NextFunction } from "express";
import { AppError } from "../../../core/utils/AppError";
import type { TenantRequest } from "../../../core/middleware/tenant.middleware";
export const tenantLogout = async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
        const { RefreshToken, AuditLog } = require("../../../infrastructure/database/models");
        const user = (req as any).user;
        if (!user) {
            throw new AppError("Not authenticated", 401);
        }
        const refreshToken = req.cookies?.refreshToken;
        if (refreshToken) {
            await RefreshToken.update(
                { revoked_at: new Date() },
                { where: { token_hash: refreshToken, user_id: user.userId } }
            );
        }
        try {
            await AuditLog.create({
                user_id: user.userId,
                action: 'LOGOUT',
                resource: 'auth',
                ip_address: req.ip || 'unknown',
                user_agent: req.headers['user-agent'] || 'unknown',
            });
        } catch (auditError) {
            console.error('Failed to create audit log:', auditError);
        }
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.json({
            status: "success",
            message: "Logged out successfully"
        });
    } catch (error) {
        next(error);
    }
};
