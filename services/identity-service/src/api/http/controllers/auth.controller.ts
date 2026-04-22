import { Request, Response, NextFunction } from 'express';
import { loginUseCase } from '../../../application/use-cases/login.usecase';
import { getPool } from '../../../infrastructure/database/db';
import { UserRepository } from '../../../infrastructure/database/UserRepository';
import { blacklistToken } from '../../../infrastructure/cache/redis.client';
import { AppError } from '../../../domain/errors/AppError';
import { decodeTokenExpiry, generateTokens, verifyRefreshToken } from '../../../infrastructure/security/token.service';
import { z } from 'zod';
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
const userRepo = new UserRepository();

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
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
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
