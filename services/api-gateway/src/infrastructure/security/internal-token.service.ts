import { createHmac } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';

export interface InternalAuthTokenPayload {
    iss: 'api-gateway';
    aud: 'tenant-service';
    sub: string;
    email: string;
    role: string;
    platformRole?: string;
    tenantId?: string;
    tenantRole?: string;
    subRole?: string;
    authzVersion?: number;
    correlationId: string;
    iat: number;
    exp: number;
    jti: string;
}

const base64UrlEncode = (value: Buffer | string): string =>
    Buffer.from(value)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

const sign = (value: string): string =>
    base64UrlEncode(createHmac('sha256', config.INTERNAL_AUTH_SIGNING_SECRET).update(value).digest());

export const signInternalAuthToken = (payload: {
    userId: string;
    email: string;
    role: string;
    platformRole?: string;
    tenantId?: string;
    tenantRole?: string;
    subRole?: string;
    authzVersion?: number;
    correlationId: string;
}): string => {
    const now = Math.floor(Date.now() / 1000);
    const tokenPayload: InternalAuthTokenPayload = {
        iss: 'api-gateway',
        aud: 'tenant-service',
        sub: payload.userId,
        email: payload.email,
        role: payload.role,
        platformRole: payload.platformRole || undefined,
        tenantId: payload.tenantId || undefined,
        tenantRole: payload.tenantRole || undefined,
        subRole: payload.subRole || undefined,
        authzVersion: payload.authzVersion,
        correlationId: payload.correlationId,
        iat: now,
        exp: now + config.INTERNAL_AUTH_TOKEN_TTL_SECONDS,
        jti: uuidv4(),
    };
    const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64UrlEncode(JSON.stringify(tokenPayload));
    const signingInput = `${header}.${body}`;
    return `${signingInput}.${sign(signingInput)}`;
};
