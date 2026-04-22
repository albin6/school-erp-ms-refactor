import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../../../infrastructure/security/token.service';
import { isTokenBlacklisted } from '../../../infrastructure/cache/redis.client';
import { AppError } from '../../../domain/errors/AppError';
import { logger } from '../../../config/logger';

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('Authentication required', 401);
        }
        const token = authHeader.split(' ')[1];
        try {
            const blacklisted = await isTokenBlacklisted(token);
            if (blacklisted) {
                throw new AppError('Invalid or expired access token', 401);
            }
        } catch (error) {
            logger.warn('Redis unavailable during HTTP auth blacklist check; falling back to JWT validation only', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        const payload = verifyAccessToken(token);
        (req as any).user = payload;
        next();
    } catch (error) {
        next(error);
    }
};

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user || user.role !== 'SUPER_ADMIN') {
        next(new AppError('Forbidden: Super Admin access required', 403));
        return;
    }
    next();
};
