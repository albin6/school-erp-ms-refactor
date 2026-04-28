import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { config } from '../../config';
import { AppError } from '../../domain/errors/AppError';

const CircuitBreaker = require('opossum');

const PROTO_PATH = path.resolve(__dirname, '../../../../../../proto/tenant.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

const tenantProto = grpc.loadPackageDefinition(packageDefinition) as any;
const client = new tenantProto.tenant.v1.TenantService(
    config.TENANT_GRPC_HOST,
    grpc.credentials.createInsecure()
);

export interface TenantInfo {
    found: boolean;
    tenantId?: string;
    name?: string;
    subdomain?: string;
    status?: string;
    isActive?: boolean;
}

export interface MembershipInfo {
    found: boolean;
    membershipId?: string;
    userId?: string;
    tenantId?: string;
    role?: 'ADMIN' | 'STAFF' | 'STUDENT';
    subRole?: string;
    branchId?: string;
    authzVersion?: number;
}

const shouldRetryGrpcError = (error: any): boolean => {
    const code = error?.code;
    const message = String(error?.message ?? '');
    return code === grpc.status.DEADLINE_EXCEEDED ||
        code === grpc.status.UNAVAILABLE ||
        /ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|socket hang up/i.test(message);
};

const sleep = async (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const fireWithRetry = async <T>(breaker: any, args: any[]): Promise<T> => {
    let lastError: AppError | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            return await breaker.fire(...args);
        } catch (error: any) {
            lastError = error instanceof AppError ? error : new AppError('Tenant Service unavailable', 503);
            if (attempt === 0 && shouldRetryGrpcError(error)) {
                await sleep(100);
                continue;
            }
            break;
        }
    }
    throw lastError ?? new AppError('Tenant Service unavailable', 503);
};

const callGetTenantById = (tenantId: string): Promise<TenantInfo> => {
    return new Promise((resolve, reject) => {
        const deadline = new Date(Date.now() + 3000);
        client.GetTenantById({ tenant_id: tenantId }, { deadline }, (error: grpc.ServiceError | null, response: any) => {
            if (error) {
                return reject(Object.assign(new AppError('Tenant Service unavailable', 503), { code: error.code }));
            }
            if (!response.found) {
                return resolve({ found: false });
            }
            resolve({
                found: true,
                tenantId: response.tenant_id,
                name: response.name,
                subdomain: response.subdomain,
                status: response.status,
                isActive: response.is_active,
            });
        });
    });
};

const callGetMembership = (userId: string, tenantId: string): Promise<MembershipInfo> => {
    return new Promise((resolve, reject) => {
        const deadline = new Date(Date.now() + 3000);
        client.GetMembership({ user_id: userId, tenant_id: tenantId }, { deadline }, (error: grpc.ServiceError | null, response: any) => {
            if (error) {
                return reject(Object.assign(new AppError('Tenant Service unavailable', 503), { code: error.code }));
            }
            if (!response.found) {
                return resolve({ found: false });
            }
            resolve({
                found: true,
                membershipId: response.membership_id,
                userId: response.user_id,
                tenantId: response.tenant_id,
                role: response.role,
                subRole: response.sub_role,
                branchId: response.branch_id,
                authzVersion: Number(response.authz_version ?? 0),
            });
        });
    });
};

const tenantByIdBreaker = new CircuitBreaker(callGetTenantById, {
    timeout: 3500,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
});

const membershipBreaker = new CircuitBreaker(callGetMembership, {
    timeout: 3500,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
});

export const getTenantById = async (tenantId: string): Promise<TenantInfo> => {
    return fireWithRetry<TenantInfo>(tenantByIdBreaker, [tenantId]);
};

export const getMembership = async (userId: string, tenantId: string): Promise<MembershipInfo> => {
    return fireWithRetry<MembershipInfo>(membershipBreaker, [userId, tenantId]);
};
