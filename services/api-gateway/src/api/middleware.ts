import { Request, Response, NextFunction } from 'express';
import { getTenantBySubdomain } from '../infrastructure/grpc/tenant.client';
import { validateToken } from '../infrastructure/grpc/identity.client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';
import { getCachedJson, setCachedJson } from '../infrastructure/cache/redis.client';
import { config } from '../config';
import { signInternalAuthToken } from '../infrastructure/security/internal-token.service';

interface CachedTenantContext {
    found: boolean;
    tenantId?: string;
    name?: string;
    status?: string;
    isActive?: boolean;
}

const normalizeTenantSubdomain = (value: string | undefined): string | null => {
    const candidate = value?.trim().toLowerCase();
    if (!candidate || candidate === 'www' || candidate === 'sadmin') {
        return null;
    }
    return /^[a-z0-9-]+$/.test(candidate) ? candidate : null;
};

const getHeaderValue = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

const spoofableIdentityHeaders = [
    'x-user-id',
    'x-user-email',
    'x-user-role',
    'x-user-subrole',
    'x-tenant-id',
    'x-auth-validated',
    'x-internal-auth-secret',
    'x-internal-auth-token',
];

const stripSpoofableIdentityHeaders = (req: Request): void => {
    for (const headerName of spoofableIdentityHeaders) {
        delete req.headers[headerName];
    }
};

export const gatewayMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        stripSpoofableIdentityHeaders(req);
        const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
        req.headers['x-correlation-id'] = correlationId;
        logger.info(`[${correlationId}] Incoming ${req.method} ${req.path}`, { correlationId });
        
        const host = req.headers.host || '';
        const subdomainMatches = host.match(/^([a-z0-9-]+)\.localhost/);
        const headerSubdomain = config.TRUST_TENANT_SUBDOMAIN_HEADER
            ? getHeaderValue(req.headers['x-tenant-subdomain'])
            : undefined;
        let tenantId = '';
        const subdomain = normalizeTenantSubdomain(subdomainMatches?.[1] ?? headerSubdomain);
        if (!config.TRUST_TENANT_SUBDOMAIN_HEADER && req.headers['x-tenant-subdomain'] && !subdomainMatches?.[1]) {
            logger.warn(`[${correlationId}] Ignoring untrusted x-tenant-subdomain header`, { correlationId });
        }
        if (subdomain) {
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
                const effectiveRole = payload.platformRole || payload.role;
                if (tenantId && payload.tenantId && tenantId !== payload.tenantId && effectiveRole !== 'SUPER_ADMIN') {
                    logger.warn(`[${correlationId}] Token tenant mismatch`, { correlationId });
                    res.status(403).json({ success: false, error: 'Token does not match tenant context' });
                    return;
                }
                req.headers['x-internal-auth-token'] = signInternalAuthToken({
                    userId: payload.userId,
                    email: payload.email,
                    role: payload.role,
                    platformRole: payload.platformRole || undefined,
                    tenantId: payload.tenantId || tenantId || undefined,
                    tenantRole: payload.tenantRole || undefined,
                    subRole: payload.subRole || undefined,
                    authzVersion: payload.authzVersion || undefined,
                    correlationId,
                });
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
