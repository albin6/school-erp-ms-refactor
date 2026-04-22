import { Request, Response, NextFunction } from 'express';
import { validateTokenGrpc } from '../../../infrastructure/grpc/identity.client';
import { AppError } from '../../../domain/errors/AppError';
import { config } from '../../../config';
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const internalSecret = req.headers['x-internal-auth-secret'];
        if (
            config.INTERNAL_AUTH_SECRET &&
            internalSecret === config.INTERNAL_AUTH_SECRET &&
            req.headers['x-auth-validated'] === 'true'
        ) {
            const userId = req.headers['x-user-id'];
            const email = req.headers['x-user-email'];
            const role = req.headers['x-user-role'];
            if (typeof userId === 'string' && typeof email === 'string' && typeof role === 'string') {
                (req as any).user = {
                    valid: true,
                    userId,
                    email,
                    role,
                    tenantId: typeof req.headers['x-tenant-id'] === 'string' ? req.headers['x-tenant-id'] : '',
                    subRole: typeof req.headers['x-user-subrole'] === 'string' ? req.headers['x-user-subrole'] : '',
                };
                next();
                return;
            }
        }
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('Authentication required', 401);
        }
        const token = authHeader.split(' ')[1];
        const payload = await validateTokenGrpc(token);
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
