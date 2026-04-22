import { Request, Response, NextFunction } from 'express';
import { getTenantBySubdomain } from '../infrastructure/grpc/tenant.client';
import { validateToken } from '../infrastructure/grpc/identity.client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';
import { getCachedJson, setCachedJson } from '../infrastructure/cache/redis.client';
import { config } from '../config';

interface CachedTenantContext {
    found: boolean;
    tenantId?: string;
    name?: string;
    status?: string;
    isActive?: boolean;
}

export const gatewayMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
        req.headers['x-correlation-id'] = correlationId;
        logger.info(`[${correlationId}] Incoming ${req.method} ${req.path}`, { correlationId });
        
        const host = req.headers.host || '';
        const subdomainMatches = host.match(/^([a-z0-9-]+)\.localhost/);
        let tenantId = '';
        if (subdomainMatches && subdomainMatches[1] !== 'www') {
            const subdomain = subdomainMatches[1];
            logger.info(`[${correlationId}] Resolving subdomain: ${subdomain}`, { correlationId });
            try {
                const cacheKey = `tenant:subdomain:${subdomain}`;
                const cachedTenant = await getCachedJson<CachedTenantContext>(cacheKey);
                const tenant = cachedTenant ?? await getTenantBySubdomain(subdomain);
                if (!cachedTenant) {
                    await setCachedJson(cacheKey, tenant, config.TENANT_CACHE_TTL_SECONDS);
                }
                if (!tenant.found || !tenant.isActive) {
                    logger.warn(`[${correlationId}] Tenant not found or inactive`, { correlationId });
                    res.status(404).json({ success: false, error: 'Tenant not found or inactive' });
                    return;
                }
                tenantId = tenant.tenantId!;
                req.headers['x-tenant-id'] = tenantId;
            } catch (err) {
                logger.error(`[${correlationId}] Tenant service error:`, err, { correlationId });
                res.status(503).json({ success: false, error: 'Tenant service unavailable' });
                return;
            }
        }
        
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            logger.info(`[${correlationId}] Validating token`, { correlationId });
            try {
                const payload = await validateToken(token);
                req.headers['x-user-id'] = payload.userId;
                req.headers['x-user-email'] = payload.email;
                req.headers['x-user-role'] = payload.role;
                req.headers['x-user-subrole'] = payload.subRole;
                if (config.INTERNAL_AUTH_SECRET) {
                    req.headers['x-auth-validated'] = 'true';
                    req.headers['x-internal-auth-secret'] = config.INTERNAL_AUTH_SECRET;
                }
                if (tenantId && payload.tenantId && tenantId !== payload.tenantId && payload.role !== 'SUPER_ADMIN') {
                    logger.warn(`[${correlationId}] Token tenant mismatch`, { correlationId });
                    res.status(403).json({ success: false, error: 'Token does not match tenant context' });
                    return;
                }
            } catch (err) {
                logger.error(`[${correlationId}] Token validation error:`, err, { correlationId });
                res.status(401).json({ success: false, error: 'Invalid authentication token' });
                return;
            }
        }
        
        logger.info(`[${correlationId}] Middleware complete, proceeding to proxy`, { correlationId });
        next();
    } catch (error) {
        logger.error('API Gateway middleware error:', error);
        res.status(500).json({ success: false, error: 'API Gateway internal error' });
    }
};
