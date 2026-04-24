import { Request, Response, NextFunction } from 'express';
import { loginUseCase } from '../../../application/use-cases/login.usecase';
import { getPool } from '../../../infrastructure/database/db';
import { UserRepository } from '../../../infrastructure/database/UserRepository';
import { blacklistToken } from '../../../infrastructure/cache/redis.client';
import { AppError } from '../../../domain/errors/AppError';
import { decodeTokenExpiry, generateTokens, verifyRefreshToken } from '../../../infrastructure/security/token.service';
import {
    initiatePasswordResetUseCase,
    verifyPasswordResetOtpUseCase,
    completePasswordResetUseCase,
    changePasswordUseCase,
} from '../../../application/use-cases/passwordReset.usecase';
import { tenantLoginUseCase } from '../../../application/use-cases/tenantLogin.usecase';
import { resolveTenantIdentifier } from '../../../infrastructure/grpc/tenant.client';
import { z } from 'zod';
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
const forgotPasswordSchema = z.object({
    email: z.string().email(),
});
const verifyOtpSchema = z.object({
    email: z.string().email(),
    otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});
const resetPasswordSchema = z.object({
    email: z.string().email(),
    resetToken: z.string().min(1),
    newPassword: z.string().min(1),
});
const tenantResetPasswordSchema = z.object({
    email: z.string().email(),
    oldPassword: z.string().min(1),
    newPassword: z.string().min(1),
});
const userRepo = new UserRepository();

const setRefreshTokenCookie = (res: Response, refreshToken: string): void => {
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
};

const resolveTenantFromRoute = async (tenantIdentifier: string) => {
    const tenant = await resolveTenantIdentifier(tenantIdentifier);
    if (!tenant.tenantId) {
        throw new AppError('Tenant not found', 404);
    }
    return tenant;
};

const assertTenantAccess = async (tenantIdentifier: string, req: Request): Promise<string> => {
    const routeTenant = await resolveTenantFromRoute(tenantIdentifier);
    const tokenTenantId = (req as any).user?.tenantId as string | undefined;

    if (!tokenTenantId || tokenTenantId !== routeTenant.tenantId) {
        throw new AppError('Forbidden', 403);
    }

    return routeTenant.tenantId;
};

export const loginController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const body = loginSchema.parse(req.body);
        const ip = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? 'unknown';
        const userAgent = req.headers['user-agent'] ?? 'unknown';
        const correlationId = req.headers['x-correlation-id'] as string;
        const result = await loginUseCase({
            email: body.email,
            password: body.password,
            ip,
            userAgent,
            correlationId,
        });
        setRefreshTokenCookie(res, result.refreshToken);
        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: result.userId,
                    email: result.email,
                    name: result.name,
                    isSuperAdmin: result.isSuperAdmin,
                    mustResetPassword: result.mustResetPassword,
                },
                accessToken: result.accessToken,
            },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
            return;
        }
        next(error);
    }
};

export const getMeController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = (req as any).user.userId;
        const user = await userRepo.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }
        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    isSuperAdmin: user.isSuperAdmin,
                    isActive: user.isActive,
                    mustResetPassword: user.mustResetPassword,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

export const logoutController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
        const refreshToken = req.cookies?.refreshToken as string | undefined;
        if (accessToken) {
            const expiry = decodeTokenExpiry(accessToken);
            const ttlSeconds = Math.max(expiry - Math.floor(Date.now() / 1000), 1);
            await blacklistToken(accessToken, ttlSeconds);
        }
        if (refreshToken) {
            await getPool().query(
                `UPDATE refresh_tokens
             SET revoked_at = NOW()
           WHERE token_hash = $1 AND revoked_at IS NULL`,
                [refreshToken]
            );
        }
        res.clearCookie('refreshToken');
        res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        next(error);
    }
};

const createTenantLoginController = (portal: 'ADMIN' | 'STAFF' | 'STUDENT') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const body = loginSchema.parse(req.body);
            const tenantIdentifier = req.params.tenantId;
            const ip = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? 'unknown';
            const userAgent = req.headers['user-agent'] ?? 'unknown';
            const correlationId = req.headers['x-correlation-id'] as string;
            const result = await tenantLoginUseCase({
                tenantIdentifier,
                email: body.email,
                password: body.password,
                portal,
                ip,
                userAgent,
                correlationId,
            });

            setRefreshTokenCookie(res, result.refreshToken);
            res.status(200).json({
                success: true,
                data: {
                    user: result.user,
                    tenant: result.tenant,
                    accessToken: result.accessToken,
                },
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                next(new AppError(error.errors[0].message, 400));
                return;
            }
            next(error);
        }
    };
};

export const tenantAdminLoginController = createTenantLoginController('ADMIN');
export const tenantStaffLoginController = createTenantLoginController('STAFF');
export const tenantStudentLoginController = createTenantLoginController('STUDENT');

export const tenantGetMeController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const tenant = await resolveTenantFromRoute(req.params.tenantId);
        const userId = (req as any).user?.userId as string | undefined;
        const tokenTenantId = (req as any).user?.tenantId as string | undefined;

        if (!userId || tokenTenantId !== tenant.tenantId) {
            throw new AppError('Forbidden', 403);
        }

        const user = await userRepo.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: (req as any).user.role,
                    subRole: (req as any).user.subRole || undefined,
                    mustResetPassword: user.mustResetPassword,
                },
                tenant: {
                    id: tenant.tenantId,
                    name: tenant.name,
                    subdomain: tenant.subdomain,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

export const tenantRefreshController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const tenant = await resolveTenantFromRoute(req.params.tenantId);
        const refreshToken = req.cookies?.refreshToken as string | undefined;
        if (!refreshToken) {
            throw new AppError('Refresh token is required', 401);
        }

        const payload = verifyRefreshToken(refreshToken);
        if (payload.tenantId !== tenant.tenantId) {
            throw new AppError('Invalid or expired refresh token', 401);
        }

        const { rows } = await getPool().query(
            `SELECT user_id, expires_at, revoked_at
         FROM refresh_tokens
        WHERE token_hash = $1
        ORDER BY created_at DESC
        LIMIT 1`,
            [refreshToken]
        );
        const tokenRow = rows[0];
        if (!tokenRow || tokenRow.revoked_at || new Date(tokenRow.expires_at) <= new Date()) {
            throw new AppError('Invalid or expired refresh token', 401);
        }

        const { accessToken } = generateTokens({
            userId: payload.userId,
            email: payload.email,
            role: payload.role,
            tenantId: payload.tenantId,
            subRole: payload.subRole,
        });

        res.status(200).json({
            success: true,
            data: { accessToken },
        });
    } catch (error) {
        next(error);
    }
};

export const tenantLogoutController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        await assertTenantAccess(req.params.tenantId, req);
        await logoutController(req, res, next);
    } catch (error) {
        next(error);
    }
};

export const refreshController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const refreshToken = req.cookies?.refreshToken as string | undefined;
        if (!refreshToken) {
            throw new AppError('Refresh token is required', 401);
        }
        const payload = verifyRefreshToken(refreshToken);
        const { rows } = await getPool().query(
            `SELECT user_id, expires_at, revoked_at
         FROM refresh_tokens
        WHERE token_hash = $1
        ORDER BY created_at DESC
        LIMIT 1`,
            [refreshToken]
        );
        const tokenRow = rows[0];
        if (!tokenRow || tokenRow.revoked_at || new Date(tokenRow.expires_at) <= new Date()) {
            throw new AppError('Invalid or expired refresh token', 401);
        }
        const { accessToken } = generateTokens({
            userId: payload.userId,
            email: payload.email,
            role: payload.role,
            tenantId: payload.tenantId,
            subRole: payload.subRole,
        });
        res.status(200).json({
            success: true,
            data: { accessToken },
        });
    } catch (error) {
        next(error);
    }
};

export const forgotPasswordController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const body = forgotPasswordSchema.parse(req.body);
        const ip = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? 'unknown';
        const result = await initiatePasswordResetUseCase(body.email, ip);
        res.status(200).json({
            success: true,
            status: 'success',
            message: 'OTP sent to your email',
            data: {
                expiresAt: result.expiresAt,
            },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
            return;
        }
        next(error);
    }
};

export const verifyOtpController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const body = verifyOtpSchema.parse(req.body);
        const result = await verifyPasswordResetOtpUseCase(body.email, body.otp);
        res.status(200).json({
            success: true,
            status: 'success',
            message: 'OTP verified successfully',
            data: {
                resetToken: result.resetToken,
            },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
            return;
        }
        next(error);
    }
};

export const resendOtpController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const body = forgotPasswordSchema.parse(req.body);
        const ip = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? 'unknown';
        const result = await initiatePasswordResetUseCase(body.email, ip);
        res.status(200).json({
            success: true,
            status: 'success',
            message: 'New OTP sent to your email',
            data: {
                expiresAt: result.expiresAt,
            },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
            return;
        }
        next(error);
    }
};

export const resetPasswordController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const body = resetPasswordSchema.parse(req.body);
        const correlationId = req.headers['x-correlation-id'] as string;
        const result = await completePasswordResetUseCase(body.email, body.resetToken, body.newPassword, correlationId);
        res.status(200).json({
            success: true,
            status: 'success',
            message: 'Password reset successfully',
            data: result,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
            return;
        }
        next(error);
    }
};

export const tenantResetPasswordController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const body = tenantResetPasswordSchema.parse(req.body);
        const correlationId = req.headers['x-correlation-id'] as string;
        const userId = (req as any).user?.userId as string | undefined;

        if (!userId) {
            throw new AppError('Authentication required', 401);
        }

        await assertTenantAccess(req.params.tenantId, req);

        await changePasswordUseCase(userId, body.email, body.oldPassword, body.newPassword, correlationId);
        res.status(200).json({
            success: true,
            message: 'Password reset successfully',
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
            return;
        }
        next(error);
    }
};
