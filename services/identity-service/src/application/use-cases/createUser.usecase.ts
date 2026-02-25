import { v4 as uuidv4 } from 'uuid';
import { UserRepository } from '../../infrastructure/database/UserRepository';
import { publishEvent } from '../../infrastructure/messaging/kafka.producer';
import { hashPassword, generateTemporaryPassword } from '../../infrastructure/security/password.service';
import { User } from '../../domain/aggregates/User';
import { logger } from '../../config/logger';
export interface CreateUserCommand {
    email: string;
    name: string;
    idempotencyKey: string;
    mustResetPassword?: boolean;
    correlationId?: string;
}
export interface CreateUserResult {
    userId: string;
    temporaryPassword: string;
    alreadyExisted: boolean;
}
const userRepo = new UserRepository();
export const createUserUseCase = async (cmd: CreateUserCommand): Promise<CreateUserResult> => {
    const existing = await userRepo.findByEmail(cmd.email);
    if (existing) {
        logger.info('CreateUser: user already exists, returning idempotent response', {
            email: cmd.email,
            idempotencyKey: cmd.idempotencyKey,
        });
        return { userId: existing.id, temporaryPassword: '', alreadyExisted: true };
    }
    const tempPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(tempPassword);
    const user = new User({
        email: cmd.email,
        passwordHash,
        name: cmd.name,
        isSuperAdmin: false,
        isActive: true,
        mustResetPassword: cmd.mustResetPassword ?? true,
    });
    const savedUser = await userRepo.save(user);
    await publishEvent('identity.user.created', {
        eventId: uuidv4(),
        eventType: 'identity.user.created',
        aggregateId: savedUser.id,
        occurredAt: new Date().toISOString(),
        correlationId: cmd.correlationId,
        payload: {
            userId: savedUser.id,
            email: savedUser.email,
            name: savedUser.name,
            temporaryPassword: tempPassword,
        },
    });
    logger.info('CreateUser: new user created', { userId: savedUser.id, email: savedUser.email });
    return { userId: savedUser.id, temporaryPassword: tempPassword, alreadyExisted: false };
};
