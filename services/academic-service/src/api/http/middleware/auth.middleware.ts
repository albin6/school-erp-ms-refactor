import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../domain/errors/AppError';
import { verifyInternalAuthToken } from '../../../infrastructure/security/internal-token.service';

type TenantRole = 'ADMIN' | 'STAFF' | 'STUDENT';

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
    try {
        const internalAuthToken = req.headers['x-internal-auth-token'];
        if (typeof internalAuthToken !== 'string' || !internalAuthToken.trim()) {
            throw new AppError('Authentication required', 401);
        }

        const payload = verifyInternalAuthToken(internalAuthToken);
        (req as any).user = {
            userId: payload.sub,
            email: payload.email,
            role: payload.role,
            platformRole: payload.platformRole ?? '',
            tenantId: payload.tenantId ?? '',
            tenantRole: payload.tenantRole ?? '',
            subRole: payload.subRole ?? '',
            authzVersion: payload.authzVersion ?? 0,
        };
        next();
    } catch (error) {
        next(error);
    }
};

export const requireTenantAccess = (allowedRoles?: TenantRole[]) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            const user = (req as any).user;
            const tenantId = req.params.tenantId;

            if (!user) {
                throw new AppError('Authentication required', 401);
            }
            if (!tenantId) {
                throw new AppError('Tenant context is required', 400);
            }
            if ((user.platformRole || user.role) === 'SUPER_ADMIN') {
                next();
                return;
            }
            if (!user.tenantId || user.tenantId !== tenantId) {
                throw new AppError('Forbidden: Tenant context mismatch', 403);
            }
            const tenantRole = (user.tenantRole || user.role) as TenantRole;
            if (allowedRoles && !allowedRoles.includes(tenantRole)) {
                throw new AppError('Forbidden: Insufficient tenant role', 403);
            }
            next();
        } catch (error) {
            next(error);
        }
    };
};
