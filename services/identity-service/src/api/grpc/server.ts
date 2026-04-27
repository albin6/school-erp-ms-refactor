import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { logger } from '../../config/logger';
import { verifyAccessToken } from '../../infrastructure/security/token.service';
import { isTokenBlacklisted } from '../../infrastructure/cache/redis.client';
import { UserRepository } from '../../infrastructure/database/UserRepository';
import { createUserUseCase } from '../../application/use-cases/createUser.usecase';
const PROTO_PATH = path.resolve(__dirname, '../../../../../../proto/identity.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const identityProto = grpc.loadPackageDefinition(packageDefinition) as any;
const userRepo = new UserRepository();
const mapUserProfile = (user: any) => ({
    user_id: user.id,
    email: user.email,
    name: user.name,
    is_active: user.isActive,
    is_super_admin: user.isSuperAdmin,
    must_reset_password: user.mustResetPassword,
    created_at: user.createdAt.toISOString(),
});
const handlers = {
    ValidateToken: async (call: any, callback: any) => {
        try {
            const { token } = call.request;
            if (!token) throw new Error('Token is required');
            const isBlacklisted = await isTokenBlacklisted(token);
            if (isBlacklisted) throw new Error('Token is revoked');
            const payload = verifyAccessToken(token);
            callback(null, {
                valid: true,
                user_id: payload.userId,
                email: payload.email,
                role: payload.role ?? payload.platformRole ?? payload.tenantRole ?? '',
                tenant_id: payload.tenantId ?? '',
                sub_role: payload.subRole ?? payload.tenantSubRole ?? '',
                platform_role: payload.platformRole ?? '',
                tenant_role: payload.tenantRole ?? '',
                authz_version: payload.authzVersion ?? 0,
                error: '',
            });
        } catch (error: any) {
            callback(null, { valid: false, error: error.message });
        }
    },
    GetUserById: async (call: any, callback: any) => {
        try {
            const user = await userRepo.findById(call.request.user_id);
            if (!user) throw new Error('User not found');
            callback(null, mapUserProfile(user));
        } catch (error: any) {
            callback({ code: grpc.status.NOT_FOUND, details: error.message });
        }
    },
    GetUserByEmail: async (call: any, callback: any) => {
        try {
            const user = await userRepo.findByEmail(call.request.email);
            if (!user) throw new Error('User not found');
            callback(null, mapUserProfile(user));
        } catch (error: any) {
            callback({ code: grpc.status.NOT_FOUND, details: error.message });
        }
    },
    BatchGetUsers: async (call: any, callback: any) => {
        try {
            const userIds = Array.from(new Set((call.request.user_ids ?? []).filter(Boolean)));
            const users = await userRepo.findByIds(userIds as string[]);
            callback(null, {
                users: users.map(mapUserProfile),
            });
        } catch (error: any) {
            logger.error('gRPC BatchGetUsers error', { error: error.message });
            callback({ code: grpc.status.INTERNAL, details: error.message });
        }
    },
    CreateUser: async (call: any, callback: any) => {
        try {
            const result = await createUserUseCase({
                email: call.request.email,
                name: call.request.name,
                idempotencyKey: call.request.idempotency_key,
                mustResetPassword: call.request.must_reset_password,
                correlationId: call.metadata?.get('x-correlation-id')?.[0]?.toString(),
            });
            callback(null, {
                user_id: result.userId,
                temporary_password: result.temporaryPassword,
                already_existed: result.alreadyExisted,
            });
        } catch (error: any) {
            logger.error('gRPC CreateUser error', { error: error.message });
            callback({ code: grpc.status.INTERNAL, details: error.message });
        }
    },
};
export const createGrpcServer = (): grpc.Server => {
    const server = new grpc.Server();
    server.addService(identityProto.identity.v1.IdentityService.service, handlers);
    return server;
};
