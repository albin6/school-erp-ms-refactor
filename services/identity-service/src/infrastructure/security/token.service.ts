import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { AppError } from '../../domain/errors/AppError';
export interface TokenPayload {
    userId: string;
    email: string;
    role: string;
    tenantId?: string;
    subRole?: string;
    exp?: number;
    iat?: number;
}
interface PasswordResetTokenPayload {
    email: string;
    purpose: 'PASSWORD_RESET';
    exp?: number;
    iat?: number;
}
export const generateTokens = (payload: Omit<TokenPayload, 'exp' | 'iat'>) => {
    const accessToken = jwt.sign(
        payload,
        config.JWT_ACCESS_SECRET,
        { expiresIn: config.JWT_ACCESS_EXPIRES_IN as unknown as number }
    );
    const refreshToken = jwt.sign(
        payload,
        config.JWT_REFRESH_SECRET,
        { expiresIn: config.JWT_REFRESH_EXPIRES_IN as unknown as number }
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
        return jwt.verify(token, config.JWT_ACCESS_SECRET) as TokenPayload;
    } catch {
        throw new AppError('Invalid or expired access token', 401);
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
        return jwt.verify(token, config.JWT_REFRESH_SECRET) as TokenPayload;
    } catch {
        throw new AppError('Invalid or expired refresh token', 401);
    }
};
export const decodeTokenExpiry = (token: string): number => {
    const decoded = jwt.decode(token) as TokenPayload;
    return decoded?.exp ?? 0;
};
