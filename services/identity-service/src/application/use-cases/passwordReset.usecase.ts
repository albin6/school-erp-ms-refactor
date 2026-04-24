import { createHash } from 'crypto';
import { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../domain/errors/AppError';
import { UserRepository } from '../../infrastructure/database/UserRepository';
import { PasswordResetTokenRepository } from '../../infrastructure/database/PasswordResetTokenRepository';
import { hashPassword, validatePasswordStrength, verifyPassword } from '../../infrastructure/security/password.service';
import { withTransaction } from '../../infrastructure/database/db';
import { insertOutboxEvent } from '../../infrastructure/database/outbox.repository';
import { sendPasswordResetOtpEmail } from '../../infrastructure/email/smtp.client';
import { generatePasswordResetToken, verifyPasswordResetToken } from '../../infrastructure/security/token.service';
import { logger } from '../../config/logger';

const OTP_EXPIRY_MINUTES = 10;
const OTP_DIGITS = 6;

const userRepo = new UserRepository();
const passwordResetTokenRepo = new PasswordResetTokenRepository();

const normalizeEmail = (email: string): string => email.toLowerCase().trim();

const generateOtp = (): string => {
    return Array.from({ length: OTP_DIGITS }, () => Math.floor(Math.random() * 10)).join('');
};

const hashOtp = (otp: string): string => {
    return createHash('sha256').update(otp).digest('hex');
};

const revokeRefreshTokens = async (userId: string, client: PoolClient): Promise<void> => {
    await client.query(
        `UPDATE refresh_tokens
         SET revoked_at = NOW()
         WHERE user_id = $1
           AND revoked_at IS NULL`,
        [userId]
    );
};

export const initiatePasswordResetUseCase = async (email: string, ipAddress?: string): Promise<{ expiresAt: string }> => {
    const normalizedEmail = normalizeEmail(email);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const user = await userRepo.findByEmail(normalizedEmail);

    if (!user) {
        logger.info('Password reset requested for unknown email; returning generic success response', { email: normalizedEmail });
        return { expiresAt: expiresAt.toISOString() };
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp);

    await withTransaction(async (client) => {
        await passwordResetTokenRepo.invalidateActiveTokens(normalizedEmail, client);
        await passwordResetTokenRepo.create(normalizedEmail, otpHash, expiresAt, ipAddress, client);
    });

    await sendPasswordResetOtpEmail(normalizedEmail, otp);
    logger.info('Password reset OTP generated', { email: normalizedEmail, expiresAt: expiresAt.toISOString() });

    return { expiresAt: expiresAt.toISOString() };
};

export const verifyPasswordResetOtpUseCase = async (email: string, otp: string): Promise<{ resetToken: string }> => {
    const normalizedEmail = normalizeEmail(email);
    const token = await passwordResetTokenRepo.findLatestActiveByEmail(normalizedEmail);

    if (!token) {
        throw new AppError('Invalid or expired OTP', 400);
    }

    const otpHash = hashOtp(otp.trim());
    if (otpHash !== token.otp_hash) {
        await passwordResetTokenRepo.incrementAttempts(token.id);
        if (token.attempts + 1 >= token.max_attempts) {
            await passwordResetTokenRepo.markUsed(token.id);
        }
        throw new AppError('Invalid or expired OTP', 400);
    }

    await passwordResetTokenRepo.markUsed(token.id);

    return {
        resetToken: generatePasswordResetToken(normalizedEmail),
    };
};

export const completePasswordResetUseCase = async (
    email: string,
    resetToken: string,
    newPassword: string,
    correlationId?: string
): Promise<{ role: string; branch_slug?: string }> => {
    const normalizedEmail = normalizeEmail(email);
    const payload = verifyPasswordResetToken(resetToken);
    if (normalizeEmail(payload.email) !== normalizedEmail) {
        throw new AppError('Invalid or expired reset token', 400);
    }

    validatePasswordStrength(newPassword);
    const user = await userRepo.findByEmail(normalizedEmail);
    if (!user) {
        throw new AppError('User not found', 404);
    }

    const passwordHash = await hashPassword(newPassword);
    user.updatePassword(passwordHash);

    await withTransaction(async (client) => {
        await userRepo.update(user, client);
        await revokeRefreshTokens(user.id, client);
        await insertOutboxEvent(
            client,
            {
                eventId: uuidv4(),
                eventType: 'identity.password.reset',
                aggregateId: user.id,
                occurredAt: new Date().toISOString(),
                correlationId,
                payload: {
                    userId: user.id,
                    email: user.email,
                },
            },
            'User'
        );
    });

    logger.info('Password reset completed', { userId: user.id, email: user.email });

    return {
        role: user.isSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN',
    };
};

export const changePasswordUseCase = async (
    userId: string,
    email: string,
    oldPassword: string,
    newPassword: string,
    correlationId?: string
): Promise<void> => {
    const normalizedEmail = normalizeEmail(email);
    const user = await userRepo.findById(userId);

    if (!user || user.email !== normalizedEmail) {
        throw new AppError('User not found', 404);
    }

    const isMatch = await verifyPassword(oldPassword, user.passwordHash);
    if (!isMatch) {
        throw new AppError('Current password is incorrect', 401);
    }

    validatePasswordStrength(newPassword);
    const passwordHash = await hashPassword(newPassword);
    user.updatePassword(passwordHash);

    await withTransaction(async (client) => {
        await userRepo.update(user, client);
        await revokeRefreshTokens(user.id, client);
        await insertOutboxEvent(
            client,
            {
                eventId: uuidv4(),
                eventType: 'identity.password.reset',
                aggregateId: user.id,
                occurredAt: new Date().toISOString(),
                correlationId,
                payload: {
                    userId: user.id,
                    email: user.email,
                },
            },
            'User'
        );
    });

    logger.info('Authenticated password change completed', { userId: user.id, email: user.email });
};
