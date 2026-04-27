import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'crypto';
import { config } from '../../config';
import { AppError } from '../../domain/errors/AppError';
export interface TokenPayload {
    userId: string;
    email: string;
    role?: string;
    platformRole?: 'SUPER_ADMIN';
    tenantId?: string;
    tenantRole?: 'ADMIN' | 'STAFF' | 'STUDENT';
    subRole?: string;
    tenantSubRole?: string;
    authzVersion?: number;
    jti?: string;
    exp?: number;
    iat?: number;
    iss?: string;
    aud?: string;
}
interface PasswordResetTokenPayload {
    email: string;
    purpose: 'PASSWORD_RESET';
    exp?: number;
    iat?: number;
}
export const generateTokens = (payload: Omit<TokenPayload, 'exp' | 'iat'>) => {
    const platformRole = payload.platformRole ?? (payload.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : undefined);
    const tenantRole = payload.tenantRole ?? (
        payload.role === 'ADMIN' || payload.role === 'STAFF' || payload.role === 'STUDENT'
            ? payload.role
            : undefined
    );
    const compatibilityRole = payload.role ?? platformRole ?? tenantRole;
    const normalizedPayload: Omit<TokenPayload, 'exp' | 'iat'> = {
        ...payload,
        role: compatibilityRole,
        platformRole,
        tenantRole,
        subRole: payload.subRole ?? payload.tenantSubRole,
        tenantSubRole: payload.tenantSubRole ?? payload.subRole,
    };
    const accessToken = jwt.sign(
        { ...normalizedPayload, jti: randomUUID() },
        config.JWT_ACCESS_SECRET,
        {
            expiresIn: config.JWT_ACCESS_EXPIRES_IN as unknown as number,
            issuer: 'identity-service',
            audience: 'school-erp-api',
        }
    );
    const refreshToken = jwt.sign(
        { ...normalizedPayload, jti: randomUUID() },
        config.JWT_REFRESH_SECRET,
        {
            expiresIn: config.JWT_REFRESH_EXPIRES_IN as unknown as number,
            issuer: 'identity-service',
            audience: 'school-erp-api',
        }
    );
    return { accessToken, refreshToken };
};
export const generatePasswordResetToken = (email: string): string => {
    return jwt.sign(
        {
            email,
            purpose: 'PASSWORD_RESET',
        } satisfies Omit<PasswordResetTokenPayload, 'exp' | 'iat'>,
        config.JWT_ACCESS_SECRET,
        { expiresIn: '15m' }
    );
};
export const verifyAccessToken = (token: string): TokenPayload => {
    try {
        return jwt.verify(token, config.JWT_ACCESS_SECRET, {
            issuer: 'identity-service',
            audience: 'school-erp-api',
        }) as TokenPayload;
    } catch {
        try {
            return jwt.verify(token, config.JWT_ACCESS_SECRET) as TokenPayload;
        } catch {
            throw new AppError('Invalid or expired access token', 401);
        }
    }
};
export const verifyPasswordResetToken = (token: string): PasswordResetTokenPayload => {
    try {
        const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as PasswordResetTokenPayload;
        if (payload.purpose !== 'PASSWORD_RESET') {
            throw new AppError('Invalid or expired reset token', 400);
        }
        return payload;
    } catch {
        throw new AppError('Invalid or expired reset token', 400);
    }
};
export const verifyRefreshToken = (token: string): TokenPayload => {
    try {
        return jwt.verify(token, config.JWT_REFRESH_SECRET, {
            issuer: 'identity-service',
            audience: 'school-erp-api',
        }) as TokenPayload;
    } catch {
        try {
            return jwt.verify(token, config.JWT_REFRESH_SECRET) as TokenPayload;
        } catch {
            throw new AppError('Invalid or expired refresh token', 401);
        }
    }
};
export const decodeTokenExpiry = (token: string): number => {
    const decoded = jwt.decode(token) as TokenPayload;
    return decoded?.exp ?? 0;
};

export const hashRefreshToken = (token: string): string => {
    return createHash('sha256').update(token).digest('hex');
};
