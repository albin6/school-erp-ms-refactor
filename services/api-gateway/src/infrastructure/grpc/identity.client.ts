import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { config } from '../../config';
const CircuitBreaker = require('opossum');
const PROTO_PATH = path.resolve(__dirname, '../../../../../../proto/identity.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
});
const identityProto = grpc.loadPackageDefinition(packageDefinition) as any;
const client = new identityProto.identity.v1.IdentityService(
    config.IDENTITY_GRPC_HOST,
    grpc.credentials.createInsecure()
);
export interface TokenPayload {
    valid: boolean;
    userId: string;
    email: string;
    role: string;
    tenantId: string;
    subRole: string;
}
const shouldRetryGrpcError = (error: any): boolean => {
    const code = error?.code;
    const message = String(error?.message ?? '');
    return code === grpc.status.DEADLINE_EXCEEDED ||
        code === grpc.status.UNAVAILABLE ||
        /ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|socket hang up/i.test(message);
};
const callValidateToken = (token: string): Promise<TokenPayload> => {
    return new Promise((resolve, reject) => {
        const deadline = new Date(Date.now() + 3000);
        client.ValidateToken({ token }, { deadline }, (error: any, response: any) => {
            if (error) {
                return reject(Object.assign(new Error('Identity Service Unavailable'), { code: error.code }));
            }
            if (!response.valid) {
                return reject(Object.assign(new Error(response.error || 'Invalid Token'), { code: 'AUTH_FAILURE' }));
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
export const validateToken = async (token: string): Promise<TokenPayload> => {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            return await breaker.fire(token);
        } catch (error: any) {
            lastError = error instanceof Error ? error : new Error('Identity Service Unavailable');
            if (attempt === 0 && shouldRetryGrpcError(error)) {
                await sleep(100);
                continue;
            }
            break;
        }
    }
    throw lastError ?? new Error('Identity Service Unavailable');
};
export const verifyIdentityGrpcConnectivity = async (): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
        const deadline = new Date(Date.now() + 3000);
        client.ValidateToken({ token: 'gateway-startup-probe' }, { deadline }, (error: any) => {
            if (error && shouldRetryGrpcError(error)) {
                return reject(Object.assign(new Error('Identity Service Unreachable'), { code: error.code }));
            }
            resolve();
        });
    });
};
