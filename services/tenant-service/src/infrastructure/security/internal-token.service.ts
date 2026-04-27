import { createHmac, timingSafeEqual } from 'crypto';
import { AppError } from '../../domain/errors/AppError';
import { config } from '../../config';

export interface InternalAuthTokenPayload {
    iss: string;
    aud: string;
    sub: string;
    email: string;
    role: string;
    platformRole?: string;
    tenantId?: string;
    tenantRole?: string;
    subRole?: string;
    authzVersion?: number;
    correlationId?: string;
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

const base64UrlDecode = (value: string): string => {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    return Buffer.from(padded, 'base64').toString('utf8');
};

const sign = (value: string): string =>
    base64UrlEncode(createHmac('sha256', config.INTERNAL_AUTH_SIGNING_SECRET).update(value).digest());

const signaturesMatch = (left: string, right: string): boolean => {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const parseJson = <T>(value: string): T => {
    try {
        return JSON.parse(value) as T;
    } catch {
        throw new AppError('Invalid internal authentication token', 401);
    }
};

export const verifyInternalAuthToken = (token: string): InternalAuthTokenPayload => {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) {
        throw new AppError('Invalid internal authentication token', 401);
    }

    const expectedSignature = sign(`${header}.${body}`);
    if (!signaturesMatch(signature, expectedSignature)) {
        throw new AppError('Invalid internal authentication token', 401);
    }

    const parsedHeader = parseJson<{ alg?: string; typ?: string }>(base64UrlDecode(header));
    if (parsedHeader.alg !== 'HS256' || parsedHeader.typ !== 'JWT') {
        throw new AppError('Invalid internal authentication token', 401);
    }

    const payload = parseJson<InternalAuthTokenPayload>(base64UrlDecode(body));
    const now = Math.floor(Date.now() / 1000);
    if (payload.iss !== 'api-gateway' || payload.aud !== 'tenant-service') {
        throw new AppError('Invalid internal authentication token', 401);
    }
    if (!payload.sub || !payload.email || !payload.role || !payload.jti) {
        throw new AppError('Invalid internal authentication token', 401);
    }
    if (payload.exp <= now) {
        throw new AppError('Internal authentication token expired', 401);
    }

    return payload;
};
