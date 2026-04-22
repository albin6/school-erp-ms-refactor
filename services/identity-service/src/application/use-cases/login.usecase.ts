import { v4 as uuidv4 } from 'uuid';
import { UserRepository } from '../../infrastructure/database/UserRepository';
import { verifyPassword } from '../../infrastructure/security/password.service';
import { generateTokens } from '../../infrastructure/security/token.service';
import { withTransaction } from '../../infrastructure/database/db';
import { insertOutboxEvent } from '../../infrastructure/database/outbox.repository';
import { AppError } from '../../domain/errors/AppError';
import { logger } from '../../config/logger';
import ms from 'ms';
import { config } from '../../config';
const userRepo = new UserRepository();
export interface LoginCommand {
    email: string;
    password: string;
    ip: string;
    userAgent: string;
    correlationId?: string;
}
export interface LoginResult {
    userId: string;
    email: string;
    name: string;
    isSuperAdmin: boolean;
    accessToken: string;
    refreshToken: string;
    mustResetPassword: boolean;
}
export const loginUseCase = async (cmd: LoginCommand): Promise<LoginResult> => {
    const user = await userRepo.findByEmail(cmd.email);
    if (!user) {
        await verifyPassword(cmd.password, '$2b$12$invalidhashinvalidhashinvalidhas');
        await withTransaction(async (client) => {
            await insertOutboxEvent(
                client,
                {
                    eventId: uuidv4(),
                    eventType: 'identity.login.failed',
                    aggregateId: uuidv4(),
                    occurredAt: new Date().toISOString(),
                    correlationId: cmd.correlationId,
                    payload: { email: cmd.email, ip: cmd.ip, userAgent: cmd.userAgent, reason: 'USER_NOT_FOUND' },
                },
                'AuthSession'
            );
        });
        throw new AppError('Invalid credentials', 401);
    }
    user.assertCanLogin();
    const isMatch = await verifyPassword(cmd.password, user.passwordHash);
    if (!isMatch) {
        user.recordFailedLogin();
        await withTransaction(async (client) => {
            await userRepo.update(user, client);
            await insertOutboxEvent(
                client,
                {
                    eventId: uuidv4(),
                    eventType: 'identity.login.failed',
                    aggregateId: user.id,
                    occurredAt: new Date().toISOString(),
                    correlationId: cmd.correlationId,
                    payload: { email: cmd.email, ip: cmd.ip, userAgent: cmd.userAgent, reason: 'INVALID_PASSWORD' },
                },
                'AuthSession'
            );
        });
        throw new AppError('Invalid credentials', 401);
    }
    user.recordSuccessfulLogin();
    const role = user.isSuperAdmin ? 'SUPER_ADMIN' : 'USER';
    const { accessToken, refreshToken } = generateTokens({ userId: user.id, email: user.email, role });
    const familyId = uuidv4();
    const expiresAt = new Date(Date.now() + ms(config.JWT_REFRESH_EXPIRES_IN as string));
    await withTransaction(async (client) => {
        await userRepo.update(user, client);
        await client.query(
            `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, created_ip)
         VALUES ($1, $2, $3, $4, $5)`,
            [user.id, refreshToken, familyId, expiresAt, cmd.ip]
        );
        await insertOutboxEvent(
            client,
            {
                eventId: uuidv4(),
                eventType: 'identity.login.succeeded',
                aggregateId: user.id,
                occurredAt: new Date().toISOString(),
                correlationId: cmd.correlationId,
                payload: { userId: user.id, email: user.email, role, ip: cmd.ip, userAgent: cmd.userAgent },
            },
            'AuthSession'
        );
    });
    logger.info('Login successful', { userId: user.id, role, ip: cmd.ip });
    return {
        userId: user.id,
        email: user.email,
        name: user.name,
        isSuperAdmin: user.isSuperAdmin,
        accessToken,
        refreshToken,
        mustResetPassword: user.mustResetPassword,
    };
};
