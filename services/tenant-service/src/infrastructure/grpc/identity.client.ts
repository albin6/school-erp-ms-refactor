import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { config } from '../../config';
import { AppError } from '../../domain/errors/AppError';
const CircuitBreaker = require('opossum');
const PROTO_PATH = path.resolve(__dirname, '../../../../../../proto/identity.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const identityProto = grpc.loadPackageDefinition(packageDefinition) as any;
const client = new identityProto.identity.v1.IdentityService(
    config.IDENTITY_GRPC_HOST,
    grpc.credentials.createInsecure()
);
export interface TokenValidationResult {
    valid: boolean;
    userId: string;
    email: string;
    role: string;
    tenantId: string;
    subRole: string;
}

export interface CreateUserResult {
    userId: string;
    temporaryPassword: string;
    alreadyExisted: boolean;
}

export interface UserProfileResult {
    userId: string;
    email: string;
    name: string;
    isActive: boolean;
    isSuperAdmin: boolean;
    mustResetPassword: boolean;
    createdAt: string;
}
const shouldRetryGrpcError = (error: any): boolean => {
    const code = error?.code;
    const message = String(error?.message ?? '');
    return code === grpc.status.DEADLINE_EXCEEDED ||
        code === grpc.status.UNAVAILABLE ||
        /ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|socket hang up/i.test(message);
};
const callValidateToken = (token: string): Promise<TokenValidationResult> => {
    return new Promise((resolve, reject) => {
        const deadline = new Date(Date.now() + 3000);
        client.ValidateToken({ token }, { deadline }, (error: grpc.ServiceError | null, response: any) => {
            if (error) {
                return reject(Object.assign(new AppError('Identity Service unavailable', 503), { code: error.code }));
            }
            if (!response.valid) {
                return reject(Object.assign(new AppError(response.error || 'Invalid token', 401), { code: 'AUTH_FAILURE' }));
            }
            resolve({
                valid: response.valid,
                userId: response.user_id,
                email: response.email,
                role: response.role,
                tenantId: response.tenant_id,
                subRole: response.sub_role,
            });
        });
    });
};
const breaker = new CircuitBreaker(callValidateToken, {
    timeout: 3500,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
});
const sleep = async (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const callCreateUser = (
    email: string,
    name: string,
    idempotencyKey: string,
    mustResetPassword: boolean,
    correlationId?: string
): Promise<CreateUserResult> => {
    return new Promise((resolve, reject) => {
        const deadline = new Date(Date.now() + 3000);
        const metadata = new grpc.Metadata();
        if (correlationId) {
            metadata.set('x-correlation-id', correlationId);
        }

        client.CreateUser(
            {
                email,
                name,
                idempotency_key: idempotencyKey,
                must_reset_password: mustResetPassword,
            },
            metadata,
            { deadline },
            (error: grpc.ServiceError | null, response: any) => {
                if (error) {
                    return reject(Object.assign(new AppError('Identity Service unavailable', 503), { code: error.code }));
                }
                resolve({
                    userId: response.user_id,
                    temporaryPassword: response.temporary_password,
                    alreadyExisted: response.already_existed,
                });
            }
        );
    });
};

const createUserBreaker = new CircuitBreaker(callCreateUser, {
    timeout: 3500,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
});

const callGetUserById = (userId: string): Promise<UserProfileResult> => {
    return new Promise((resolve, reject) => {
        const deadline = new Date(Date.now() + 3000);
        client.GetUserById({ user_id: userId }, { deadline }, (error: grpc.ServiceError | null, response: any) => {
            if (error) {
                return reject(Object.assign(new AppError('Identity Service unavailable', 503), { code: error.code }));
            }
            resolve({
                userId: response.user_id,
                email: response.email,
                name: response.name,
                isActive: response.is_active,
                isSuperAdmin: response.is_super_admin,
                mustResetPassword: response.must_reset_password,
                createdAt: response.created_at,
            });
        });
    });
};

const getUserByIdBreaker = new CircuitBreaker(callGetUserById, {
    timeout: 3500,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
});

const callBatchGetUsers = (userIds: string[]): Promise<UserProfileResult[]> => {
    return new Promise((resolve, reject) => {
        const deadline = new Date(Date.now() + 5000);
        client.BatchGetUsers({ user_ids: userIds }, { deadline }, (error: grpc.ServiceError | null, response: any) => {
            if (error) {
                return reject(Object.assign(new AppError('Identity Service unavailable', 503), { code: error.code }));
            }
            resolve((response.users ?? []).map((user: any) => ({
                userId: user.user_id,
                email: user.email,
                name: user.name,
                isActive: user.is_active,
                isSuperAdmin: user.is_super_admin,
                mustResetPassword: user.must_reset_password,
                createdAt: user.created_at,
            })));
        });
    });
};

const batchGetUsersBreaker = new CircuitBreaker(callBatchGetUsers, {
    timeout: 5500,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
});
export const validateTokenGrpc = async (token: string): Promise<TokenValidationResult> => {
    let lastError: AppError | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            return await breaker.fire(token);
        } catch (error: any) {
            lastError = error instanceof AppError ? error : new AppError('Identity Service unavailable', 503);
            if (attempt === 0 && shouldRetryGrpcError(error)) {
                await sleep(100);
                continue;
            }
            break;
        }
    }
    throw lastError ?? new AppError('Identity Service unavailable', 503);
};

export const createUserGrpc = async (
    email: string,
    name: string,
    idempotencyKey: string,
    mustResetPassword: boolean,
    correlationId?: string
): Promise<CreateUserResult> => {
    let lastError: AppError | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            return await createUserBreaker.fire(email, name, idempotencyKey, mustResetPassword, correlationId);
        } catch (error: any) {
            lastError = error instanceof AppError ? error : new AppError('Identity Service unavailable', 503);
            if (attempt === 0 && shouldRetryGrpcError(error)) {
                await sleep(100);
                continue;
            }
            break;
        }
    }
    throw lastError ?? new AppError('Identity Service unavailable', 503);
};

export const getUserByIdGrpc = async (userId: string): Promise<UserProfileResult> => {
    let lastError: AppError | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            return await getUserByIdBreaker.fire(userId);
        } catch (error: any) {
            lastError = error instanceof AppError ? error : new AppError('Identity Service unavailable', 503);
            if (attempt === 0 && shouldRetryGrpcError(error)) {
                await sleep(100);
                continue;
            }
            break;
        }
    }
    throw lastError ?? new AppError('Identity Service unavailable', 503);
};

export const batchGetUsersGrpc = async (userIds: string[]): Promise<UserProfileResult[]> => {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueUserIds.length === 0) {
        return [];
    }

    let lastError: AppError | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            return await batchGetUsersBreaker.fire(uniqueUserIds);
        } catch (error: any) {
            lastError = error instanceof AppError ? error : new AppError('Identity Service unavailable', 503);
            if (attempt === 0 && shouldRetryGrpcError(error)) {
                await sleep(100);
                continue;
            }
            break;
        }
    }
    throw lastError ?? new AppError('Identity Service unavailable', 503);
};
