import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { config } from '../../config';
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
export const getTenantBySubdomain = (subdomain: string): Promise<TenantDetails> => {
    return new Promise((resolve, reject) => {
        const deadline = new Date(Date.now() + 5000); // 5 second timeout
        client.GetTenantBySubdomain({ subdomain }, { deadline }, (error: any, response: any) => {
            if (error) return reject(new Error('Tenant Service Unavailable'));
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
