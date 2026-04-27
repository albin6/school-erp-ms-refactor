import { v4 as uuidv4 } from 'uuid';
import ms from 'ms';
import { AppError } from '../../domain/errors/AppError';
import { UserRepository } from '../../infrastructure/database/UserRepository';
import { verifyPassword } from '../../infrastructure/security/password.service';
import { generateTokens, hashRefreshToken } from '../../infrastructure/security/token.service';
import { getMembership, resolveTenantIdentifier } from '../../infrastructure/grpc/tenant.client';
import { withTransaction } from '../../infrastructure/database/db';
import { insertOutboxEvent } from '../../infrastructure/database/outbox.repository';
import { config } from '../../config';
import { logger } from '../../config/logger';

const userRepo = new UserRepository();

export interface TenantLoginCommand {
    tenantIdentifier: string;
    email: string;
    password: string;
    portal: 'ADMIN' | 'STAFF' | 'STUDENT';
    ip: string;
    userAgent: string;
    correlationId?: string;
}

export interface TenantLoginResult {
    user: {
        id: string;
        email: string;
        name: string;
        role: 'ADMIN' | 'STAFF' | 'STUDENT';
        subRole?: string;
        mustResetPassword: boolean;
    };
    tenant: {
        id: string;
        name: string;
        subdomain: string;
    };
    accessToken: string;
    refreshToken: string;
}

const publishLoginFailed = async (
    aggregateId: string,
    email: string,
    reason: string,
    ip: string,
    userAgent: string,
    correlationId?: string
): Promise<void> => {
    await withTransaction(async (client) => {
        await insertOutboxEvent(
            client,
            {
                eventId: uuidv4(),
                eventType: 'identity.login.failed',
                aggregateId,
                occurredAt: new Date().toISOString(),
                correlationId,
                payload: {
                    email,
                    ip,
                    userAgent,
                    reason,
                },
            },
            'AuthSession'
        );
    });
};

export const tenantLoginUseCase = async (cmd: TenantLoginCommand): Promise<TenantLoginResult> => {
    const tenant = await resolveTenantIdentifier(cmd.tenantIdentifier);
    if (!tenant.isActive) {
        throw new AppError('Tenant is inactive', 403);
    }

    const user = await userRepo.findByEmail(cmd.email);
    if (!user) {
        await verifyPassword(cmd.password, '$2b$12$invalidhashinvalidhashinvalidhas');
        await publishLoginFailed(uuidv4(), cmd.email, 'USER_NOT_FOUND', cmd.ip, cmd.userAgent, cmd.correlationId);
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
                    payload: {
                        email: cmd.email,
                        ip: cmd.ip,
                        userAgent: cmd.userAgent,
                        reason: 'INVALID_PASSWORD',
                    },
                },
                'AuthSession'
            );
        });
        throw new AppError('Invalid credentials', 401);
    }

    const membership = await getMembership(user.id, tenant.tenantId!);
    if (!membership.found || membership.role !== cmd.portal) {
        await publishLoginFailed(user.id, cmd.email, 'INVALID_ROLE', cmd.ip, cmd.userAgent, cmd.correlationId);
        throw new AppError('Invalid credentials', 401);
    }

    user.recordSuccessfulLogin();
    const { accessToken, refreshToken } = generateTokens({
        userId: user.id,
        email: user.email,
        role: membership.role!,
        tenantRole: membership.role!,
        tenantId: tenant.tenantId,
        subRole: membership.subRole || undefined,
        tenantSubRole: membership.subRole || undefined,
        authzVersion: membership.authzVersion,
    });
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const familyId = uuidv4();
    const expiresAt = new Date(Date.now() + ms(config.JWT_REFRESH_EXPIRES_IN as string));

    await withTransaction(async (client) => {
        await userRepo.update(user, client);
        await client.query(
            `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, created_ip)
             VALUES ($1, $2, $3, $4, $5)`,
            [user.id, refreshTokenHash, familyId, expiresAt, cmd.ip]
        );
        await insertOutboxEvent(
            client,
            {
                eventId: uuidv4(),
                eventType: 'identity.login.succeeded',
                aggregateId: user.id,
                occurredAt: new Date().toISOString(),
                correlationId: cmd.correlationId,
                payload: {
                    userId: user.id,
                    email: user.email,
                    role: membership.role,
                    tenantId: tenant.tenantId,
                    ip: cmd.ip,
                    userAgent: cmd.userAgent,
                },
            },
            'AuthSession'
        );
    });

    logger.info('Tenant login successful', {
        userId: user.id,
        tenantId: tenant.tenantId,
        role: membership.role,
        portal: cmd.portal,
        ip: cmd.ip,
    });

    return {
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: membership.role!,
            subRole: membership.subRole || undefined,
            mustResetPassword: user.mustResetPassword,
        },
        tenant: {
            id: tenant.tenantId!,
            name: tenant.name!,
            subdomain: tenant.subdomain!,
        },
        accessToken,
        refreshToken,
    };
};
