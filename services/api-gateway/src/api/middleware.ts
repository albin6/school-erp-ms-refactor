import { Request, Response, NextFunction } from 'express';
import { getTenantBySubdomain } from '../infrastructure/grpc/tenant.client';
import { validateToken } from '../infrastructure/grpc/identity.client';
import { v4 as uuidv4 } from 'uuid';
export const gatewayMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
        req.headers['x-correlation-id'] = correlationId;
        const host = req.headers.host || '';
        const subdomainMatches = host.match(/^([a-z0-9-]+)\.localhost/);
        let tenantId = '';
        if (subdomainMatches && subdomainMatches[1] !== 'www') {
            const subdomain = subdomainMatches[1];
            const tenant = await getTenantBySubdomain(subdomain);
            if (!tenant.found || !tenant.isActive) {
                res.status(404).json({ success: false, error: 'Tenant not found or inactive' });
                return;
            }
            tenantId = tenant.tenantId!;
            req.headers['x-tenant-id'] = tenantId;
        }
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const payload = await validateToken(token);
                req.headers['x-user-id'] = payload.userId;
                req.headers['x-user-email'] = payload.email;
                req.headers['x-user-role'] = payload.role;
                req.headers['x-user-subrole'] = payload.subRole;
                if (tenantId && payload.tenantId && tenantId !== payload.tenantId && payload.role !== 'SUPER_ADMIN') {
                    res.status(403).json({ success: false, error: 'Token does not match tenant context' });
                    return;
                }
            } catch (err) {
                res.status(401).json({ success: false, error: 'Invalid authentication token' });
                return;
            }
        }
        next();
    } catch (error) {
        res.status(500).json({ success: false, error: 'API Gateway internal error' });
    }
};
