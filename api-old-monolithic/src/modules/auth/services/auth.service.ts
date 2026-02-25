import { User, RefreshToken, AuditLog } from "../../../infrastructure/database/models";
import { AppError } from "../../../core/utils/AppError";
import * as PasswordService from "../../../core/security/password.service";
import * as TokenService from "../../../core/security/token.service";
import { AuthCacheService } from "./auth.cache.service";
import { v4 as uuidv4 } from 'uuid';
import ms from "ms";
export class AuthService {
    static async login(email: string, password: string, ip: string, userAgent: string) {
        const isDevelopment = process.env.NODE_ENV === 'development';
        const envSuperAdminEmail = process.env.SUPER_ADMIN_EMAIL;
        const envSuperAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
        if (isDevelopment && envSuperAdminEmail && envSuperAdminPassword) {
            if (email === envSuperAdminEmail && password === envSuperAdminPassword) {
                console.log(' Development Super Admin login (environment-based)');
                const virtualUser = {
                    id: '00000000-0000-0000-0000-000000000001',
                    email: envSuperAdminEmail,
                    name: 'Super Admin (Dev)',
                    is_super_admin: true,
                };
                const { accessToken, refreshToken } = TokenService.generateTokens({
                    userId: virtualUser.id,
                    email: virtualUser.email,
                    role: 'SUPER_ADMIN',
                });
                console.log('️  Environment-based login: Tokens generated, no DB persistence');
                return {
                    user: virtualUser,
                    accessToken,
                    refreshToken,
                };
            }
        }
        const user = await User.findOne({ where: { email } });
        if (!user) {
            await PasswordService.verifyPassword(password, "$2a$10$abcdefghijklmnopqrstuvwxyz123456");
            throw new AppError("Invalid credentials", 401);
        }
        if (user.lockout_until && user.lockout_until > new Date()) {
            throw new AppError("Account is temporarily locked. Try again later.", 429);
        }
        const isMatch = await PasswordService.verifyPassword(password, user.password_hash);
        if (!isMatch) {
            user.failed_login_attempts += 1;
            if (user.failed_login_attempts >= 5) {
                user.lockout_until = new Date(Date.now() + 15 * 60 * 1000);
            }
            await user.save();
            throw new AppError("Invalid credentials", 401);
        }
        user.failed_login_attempts = 0;
        user.lockout_until = null;
        user.last_login_at = new Date();
        await user.save();
        const { accessToken, refreshToken } = TokenService.generateTokens({
            userId: user.id,
            email: user.email,
            role: user.is_super_admin ? 'SUPER_ADMIN' : 'USER'
        });
        const familyId = uuidv4();
        await RefreshToken.create({
            token_hash: refreshToken,
            user_id: user.id,
            expires_at: new Date(Date.now() + ms((process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any)),
            family_id: familyId,
            created_ip: ip
        });
        await AuditLog.create({
            user_id: user.id,
            action: "LOGIN_SUCCESS",
            resource: "auth",
            ip_address: ip,
            user_agent: userAgent
        });
        return { user, accessToken, refreshToken };
    }
    static async refreshToken(oldRefreshToken: string, ip: string) {
        let payload;
        try {
            payload = TokenService.verifyRefreshToken(oldRefreshToken);
        } catch (err) {
            throw new AppError("Invalid Refresh Token", 401);
        }
        const tokenRecord = await RefreshToken.findOne({ where: { token_hash: oldRefreshToken } });
        if (!tokenRecord) {
            throw new AppError("Invalid Refresh Token", 401);
        }
        if (tokenRecord.revoked_at) {
            await RefreshToken.update({ revoked_at: new Date() }, { where: { family_id: tokenRecord.family_id } });
            throw new AppError("Refresh Token Reuse Detected - Please Login Again", 403);
        }
        tokenRecord.revoked_at = new Date();
        await tokenRecord.save();
        const { accessToken: newAccess, refreshToken: newRefresh } = TokenService.generateTokens({
            userId: payload.userId,
            email: payload.email,
            role: payload.role,
            tenantId: payload.tenantId,
            subRole: payload.subRole
        });
        await RefreshToken.create({
            token_hash: newRefresh,
            user_id: payload.userId,
            expires_at: new Date(Date.now() + ms((process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any)),
            family_id: tokenRecord.family_id,
            created_ip: ip
        });
        return { accessToken: newAccess, refreshToken: newRefresh };
    }
    static async logout(refreshToken: string, accessToken: string, userId?: string, ip?: string, userAgent?: string) {
        try {
            let loggedUserId = userId;
            if (refreshToken) {
                const tokenRecord = await RefreshToken.findOne({ where: { token_hash: refreshToken } });
                if (tokenRecord) {
                    tokenRecord.revoked_at = new Date();
                    await tokenRecord.save();
                    loggedUserId = loggedUserId || tokenRecord.user_id;
                }
            }
            if (accessToken) {
                try {
                    const payload = TokenService.verifyAccessToken(accessToken);
                    loggedUserId = loggedUserId || payload.userId;
                    const exp = payload.exp as number;
                    const now = Math.floor(Date.now() / 1000);
                    const ttl = exp - now;
                    if (ttl > 0) {
                        await AuthCacheService.blacklistToken(accessToken, ttl);
                    }
                } catch (err) {
                }
            }
            if (loggedUserId && loggedUserId !== '00000000-0000-0000-0000-000000000001') {
                await AuditLog.create({
                    user_id: loggedUserId,
                    action: "LOGOUT_SUCCESS",
                    resource: "auth",
                    ip_address: ip || null,
                    user_agent: userAgent || null
                });
            }
            return { success: true };
        } catch (error) {
            console.error("Logout error:", error);
            throw new AppError("Logout failed", 500);
        }
    }
    static async logoutAll(userId: string, ip?: string, userAgent?: string) {
        try {
            await RefreshToken.update(
                { revoked_at: new Date() },
                { where: { user_id: userId, revoked_at: null } }
            );
            if (userId !== '00000000-0000-0000-0000-000000000001') {
                await AuditLog.create({
                    user_id: userId,
                    action: "LOGOUT_ALL_DEVICES",
                    resource: "auth",
                    ip_address: ip || null,
                    user_agent: userAgent || null
                });
            }
            return { success: true, message: "Logged out from all devices" };
        } catch (error) {
            console.error("Logout all error:", error);
            throw new AppError("Failed to logout from all devices", 500);
        }
    }
    static async loginWithTenantContext(
        email: string,
        password: string,
        tenantId: string,
        expectedRole: 'ADMIN' | 'STAFF' | 'STUDENT',
        ip: string,
        userAgent: string
    ) {
        const { verifyPassword } = require("../../../core/security/password.service");
        const { TenantUser, Tenant } = require("../../../infrastructure/database/models");
        const user = await User.findOne({ where: { email } });
        if (!user) {
            throw new AppError("Invalid credentials", 401);
        }
        if (user.lockout_until && user.lockout_until > new Date()) {
            throw new AppError("Account is locked. Try again later.", 403);
        }
        const isMatch = await verifyPassword(password, user.password_hash);
        if (!isMatch) {
            await user.update({
                failed_login_attempts: user.failed_login_attempts + 1,
                lockout_until: user.failed_login_attempts >= 4 ? new Date(Date.now() + 15 * 60 * 1000) : null
            });
            throw new AppError("Invalid credentials", 401);
        }
        const tenantUser = await TenantUser.findOne({
            where: {
                user_id: user.id,
                tenant_id: tenantId
            }
        });
        if (!tenantUser) {
            const tenant = await Tenant.findByPk(tenantId);
            const tenantName = tenant ? tenant.name : 'this tenant';
            throw new AppError(`You do not have access to ${tenantName}`, 403);
        }
        const tenant = await Tenant.findByPk(tenantId);
        if (tenant && (tenant.status !== 'ACTIVE' || !tenant.is_active)) {
            throw new AppError("This tenant account has been suspended. Please contact support.", 403);
        }
        if (tenantUser.role !== expectedRole) {
            throw new AppError(`Access denied. This login is for ${expectedRole} users only. You are registered as ${tenantUser.role}`, 403);
        }
        user.failed_login_attempts = 0;
        user.lockout_until = null;
        user.last_login_at = new Date();
        await user.save();
        const { accessToken, refreshToken } = TokenService.generateTokens({
            userId: user.id,
            email: user.email,
            role: tenantUser.role,
            tenantId: tenantId,
            subRole: tenantUser.sub_role || undefined
        });
        const familyId = uuidv4();
        await RefreshToken.create({
            token_hash: refreshToken,
            user_id: user.id,
            expires_at: new Date(Date.now() + ms((process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any)),
            family_id: familyId,
            created_ip: ip
        });
        await AuditLog.create({
            user_id: user.id,
            action: `LOGIN_SUCCESS_${expectedRole}`,
            resource: "tenant_auth",
            ip_address: ip,
            user_agent: userAgent,
            metadata: { tenant_id: tenantId, role: tenantUser.role, sub_role: tenantUser.sub_role }
        });
        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: tenantUser.role,
                subRole: tenantUser.sub_role
            },
            tenant: {
                id: tenant.id,
                name: tenant.name,
                subdomain: tenant.subdomain
            },
            accessToken,
            refreshToken
        };
    }
}
