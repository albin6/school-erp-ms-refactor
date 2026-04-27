import { describe, expect, it } from '@jest/globals';
import { signInternalAuthToken } from './internal-token.service';

const decodeBase64UrlJson = <T>(value: string): T => {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as T;
};

describe('signInternalAuthToken', () => {
    it('creates a tenant-service scoped signed token with short-lived auth context', () => {
        const token = signInternalAuthToken({
            userId: 'user-1',
            email: 'admin@example.com',
            role: 'SUPER_ADMIN',
            platformRole: 'SUPER_ADMIN',
            tenantId: 'tenant-1',
            correlationId: 'corr-1',
        });

        const [header, body, signature] = token.split('.');
        expect(header).toBeTruthy();
        expect(body).toBeTruthy();
        expect(signature).toBeTruthy();

        expect(decodeBase64UrlJson<{ alg: string; typ: string }>(header)).toEqual({
            alg: 'HS256',
            typ: 'JWT',
        });

        const payload = decodeBase64UrlJson<Record<string, any>>(body);
        expect(payload).toMatchObject({
            iss: 'api-gateway',
            aud: 'tenant-service',
            sub: 'user-1',
            email: 'admin@example.com',
            role: 'SUPER_ADMIN',
            platformRole: 'SUPER_ADMIN',
            tenantId: 'tenant-1',
            correlationId: 'corr-1',
        });
        expect(payload.exp - payload.iat).toBeGreaterThan(0);
        expect(payload.exp - payload.iat).toBeLessThanOrEqual(300);
        expect(payload.jti).toBeTruthy();
    });
});
