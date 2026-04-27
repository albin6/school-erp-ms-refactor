import { describe, expect, it } from '@jest/globals';
import { createHmac } from 'crypto';
import { verifyInternalAuthToken } from './internal-token.service';
import { config } from '../../config';

const base64UrlEncode = (value: Buffer | string): string =>
    Buffer.from(value)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

const createToken = (payloadOverrides: Record<string, unknown> = {}, secret = config.INTERNAL_AUTH_SIGNING_SECRET): string => {
    const now = Math.floor(Date.now() / 1000);
    const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64UrlEncode(JSON.stringify({
        iss: 'api-gateway',
        aud: 'tenant-service',
        sub: 'user-1',
        email: 'admin@example.com',
        role: 'SUPER_ADMIN',
        platformRole: 'SUPER_ADMIN',
        iat: now,
        exp: now + 60,
        jti: 'jti-1',
        ...payloadOverrides,
    }));
    const signingInput = `${header}.${body}`;
    const signature = base64UrlEncode(createHmac('sha256', secret).update(signingInput).digest());
    return `${signingInput}.${signature}`;
};

describe('verifyInternalAuthToken', () => {
    it('accepts a valid gateway-issued internal auth token', () => {
        const payload = verifyInternalAuthToken(createToken({ tenantId: 'tenant-1' }));

        expect(payload).toMatchObject({
            iss: 'api-gateway',
            aud: 'tenant-service',
            sub: 'user-1',
            email: 'admin@example.com',
            role: 'SUPER_ADMIN',
            platformRole: 'SUPER_ADMIN',
            tenantId: 'tenant-1',
        });
    });

    it('rejects wrong audience', () => {
        expect(() => verifyInternalAuthToken(createToken({ aud: 'identity-service' })))
            .toThrow('Invalid internal authentication token');
    });

    it('rejects expired tokens', () => {
        const now = Math.floor(Date.now() / 1000);
        expect(() => verifyInternalAuthToken(createToken({ iat: now - 120, exp: now - 60 })))
            .toThrow('Internal authentication token expired');
    });

    it('rejects tampered signatures', () => {
        expect(() => verifyInternalAuthToken(createToken({}, 'wrong-secret-with-enough-length-123456')))
            .toThrow('Invalid internal authentication token');
    });
});
