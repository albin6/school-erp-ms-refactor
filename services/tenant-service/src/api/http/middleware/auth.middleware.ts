import { Request, Response, NextFunction } from 'express';
import { validateTokenGrpc } from '../../../infrastructure/grpc/identity.client';
import { AppError } from '../../../domain/errors/AppError';
import { logger } from '../../../config/logger';
import { MembershipRepository } from '../../../infrastructure/database/MembershipRepository';
import { verifyInternalAuthToken } from '../../../infrastructure/security/internal-token.service';

type TenantRole = 'ADMIN' | 'STAFF' | 'STUDENT';

const membershipRepo = new MembershipRepository();

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const internalAuthToken = req.headers['x-internal-auth-token'];
        if (typeof internalAuthToken === 'string' && internalAuthToken.trim()) {
            const payload = verifyInternalAuthToken(internalAuthToken);
            (req as any).user = {
                valid: true,
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
            return;
        }

        if (req.headers['x-auth-validated'] || req.headers['x-internal-auth-secret'] || req.headers['x-user-id']) {
            logger.warn('Rejected legacy or spoofed internal auth headers; falling back to bearer token validation', {
                host: req.headers.host,
            });
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
    if (!user || (user.platformRole || user.role) !== 'SUPER_ADMIN') {
        next(new AppError('Forbidden: Super Admin access required', 403));
        return;
    }
    next();
};

export const requireTenantAccess = (allowedRoles?: TenantRole[]) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const user = (req as any).user;
            const tenantId = req.params.tenantId ?? req.params.id;

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
            if (user.tenantId && user.tenantId !== tenantId) {
                throw new AppError('Forbidden: Tenant context mismatch', 403);
            }

            const existingMembership = (req as any).tenantMembership;
            const membership = existingMembership?.tenantId === tenantId
                ? existingMembership
                : await membershipRepo.findByUserAndTenant(user.userId, tenantId);
            if (!membership) {
                throw new AppError('Forbidden: Tenant access required', 403);
            }
            if (allowedRoles && !allowedRoles.includes(membership.role as TenantRole)) {
                throw new AppError('Forbidden: Insufficient tenant role', 403);
            }

            (req as any).tenantMembership = membership;
            next();
        } catch (error) {
            next(error);
        }
    };
};
