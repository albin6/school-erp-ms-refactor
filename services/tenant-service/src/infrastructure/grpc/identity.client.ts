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
const callValidateToken = (token: string): Promise<TokenValidationResult> => {
    return new Promise((resolve, reject) => {
        const deadline = new Date(Date.now() + 3000);
        client.ValidateToken({ token }, { deadline }, (error: grpc.ServiceError | null, response: any) => {
            if (error) {
                return reject(new AppError('Identity Service unavailable', 503));
            }
            if (!response.valid) {
                return reject(new AppError(response.error || 'Invalid token', 401));
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
export const validateTokenGrpc = async (token: string): Promise<TokenValidationResult> => {
    let lastError: AppError | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            return await breaker.fire(token);
        } catch (error: any) {
            lastError = error instanceof AppError ? error : new AppError('Identity Service unavailable', 503);
            if (attempt === 0) {
                await sleep(100);
            }
        }
    }
    throw lastError ?? new AppError('Identity Service unavailable', 503);
};
