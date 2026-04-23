import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { config } from '../../config';
const CircuitBreaker = require('opossum');
const PROTO_PATH = path.resolve(__dirname, '../../../../../../proto/tenant.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
});
const tenantProto = grpc.loadPackageDefinition(packageDefinition) as any;
const client = new tenantProto.tenant.v1.TenantService(
    config.TENANT_GRPC_HOST,
    grpc.credentials.createInsecure()
);
export interface TenantDetails {
    found: boolean;
    tenantId?: string;
    name?: string;
    status?: string;
    isActive?: boolean;
}
const shouldRetryGrpcError = (error: any): boolean => {
    const code = error?.code;
    const message = String(error?.message ?? '');
    return code === grpc.status.DEADLINE_EXCEEDED ||
        code === grpc.status.UNAVAILABLE ||
        /ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|socket hang up/i.test(message);
};
const callGetTenantBySubdomain = (subdomain: string): Promise<TenantDetails> => {
    return new Promise((resolve, reject) => {
        const deadline = new Date(Date.now() + 3000);
        client.GetTenantBySubdomain({ subdomain }, { deadline }, (error: any, response: any) => {
            if (error) return reject(Object.assign(new Error('Tenant Service Unavailable'), { code: error.code }));
            if (!response.found) {
                return resolve({ found: false });
            }
            resolve({
                found: true,
                tenantId: response.tenant_id,
                name: response.name,
                status: response.status,
                isActive: response.is_active,
            });
        });
    });
};
const breaker = new CircuitBreaker(callGetTenantBySubdomain, {
    timeout: 3500,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
});
const sleep = async (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
export const getTenantBySubdomain = async (subdomain: string): Promise<TenantDetails> => {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            return await breaker.fire(subdomain);
        } catch (error: any) {
            lastError = error instanceof Error ? error : new Error('Tenant Service Unavailable');
            if (attempt === 0 && shouldRetryGrpcError(error)) {
                await sleep(100);
                continue;
            }
            break;
        }
    }
    throw lastError ?? new Error('Tenant Service Unavailable');
};
export const verifyTenantGrpcConnectivity = async (): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
        const deadline = new Date(Date.now() + 3000);
        client.GetTenantBySubdomain({ subdomain: 'gateway-startup-probe' }, { deadline }, (error: any) => {
            if (error && shouldRetryGrpcError(error)) {
                return reject(Object.assign(new Error('Tenant Service Unreachable'), { code: error.code }));
            }
            resolve();
        });
    });
};
