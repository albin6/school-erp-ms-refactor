import { Request, Response, NextFunction } from 'express';
import { validateTokenGrpc } from '../../../infrastructure/grpc/identity.client';
import { AppError } from '../../../domain/errors/AppError';
import { config } from '../../../config';
import { logger } from '../../../config/logger';
const trustedIpSet = new Set(
    config.INTERNAL_TRUSTED_IPS
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean)
);
const normalizeIp = (value: string): string => value.replace(/^::ffff:/, '');
const isPrivateOrLoopbackIp = (ip: string): boolean => {
    const normalized = normalizeIp(ip);
    if (normalized === '::1' || normalized === '127.0.0.1') return true;
    if (normalized.startsWith('10.') || normalized.startsWith('192.168.') || normalized.startsWith('169.254.')) {
        return true;
    }
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) {
        return true;
    }
    return normalized.startsWith('fc') || normalized.startsWith('fd');
};
const getRequestSourceIps = (req: Request): string[] => {
    const forwardedFor = req.headers['x-forwarded-for'];
    const forwardedIps = typeof forwardedFor === 'string'
        ? forwardedFor.split(',').map((ip) => ip.trim()).filter(Boolean)
        : [];
    const remoteAddress = req.socket.remoteAddress ? [req.socket.remoteAddress] : [];
    return [...new Set([...forwardedIps, ...remoteAddress].map(normalizeIp))];
};
const isTrustedInternalSource = (req: Request): boolean => {
    const sourceIps = getRequestSourceIps(req);
    if (sourceIps.some((ip) => trustedIpSet.has(ip))) {
        return true;
    }
    return sourceIps.some(isPrivateOrLoopbackIp);
};
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const internalSecret = req.headers['x-internal-auth-secret'];
        const hasInternalAuthHeaders = Boolean(internalSecret || req.headers['x-auth-validated']);
        if (config.INTERNAL_AUTH_SECRET && internalSecret === config.INTERNAL_AUTH_SECRET && req.headers['x-auth-validated'] === 'true') {
            if (!isTrustedInternalSource(req)) {
                logger.warn('Rejected trusted internal auth shortcut from untrusted source; falling back to gRPC validation', {
                    sourceIps: getRequestSourceIps(req),
                    host: req.headers.host,
                });
            } else {
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
                logger.warn('Internal auth shortcut missing required identity headers; falling back to gRPC validation', {
                    sourceIps: getRequestSourceIps(req),
                    host: req.headers.host,
                });
            }
        } else if (hasInternalAuthHeaders) {
            logger.warn('Suspicious internal auth headers detected with invalid or missing INTERNAL_AUTH_SECRET; falling back to gRPC validation', {
                sourceIps: getRequestSourceIps(req),
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
    if (!user || user.role !== 'SUPER_ADMIN') {
        next(new AppError('Forbidden: Super Admin access required', 403));
        return;
    }
    next();
};
