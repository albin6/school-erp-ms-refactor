import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { TenantRepository } from '../../infrastructure/database/TenantRepository';
import { MembershipRepository } from '../../infrastructure/database/MembershipRepository';
import { logger } from '../../config/logger';
const PROTO_PATH = path.resolve(__dirname, '../../../../../../proto/tenant.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const tenantProto = grpc.loadPackageDefinition(packageDefinition) as any;
const tenantRepo = new TenantRepository();
const mapRepo = new MembershipRepository();
const handlers = {
    GetTenantBySubdomain: async (call: any, callback: any) => {
        try {
            const tenant = await tenantRepo.findBySubdomain(call.request.subdomain);
            if (!tenant) {
                return callback(null, { found: false });
            }
            callback(null, {
                found: true,
                tenant_id: tenant.id,
                name: tenant.name,
                subdomain: tenant.subdomain,
                status: tenant.status,
                is_active: tenant.isActive,
                settings_json: JSON.stringify(tenant.settings),
            });
        } catch (error: any) {
            logger.error('gRPC GetTenantBySubdomain error', { error: error.message });
            callback({ code: grpc.status.INTERNAL, details: error.message });
        }
    },
    GetTenantById: async (call: any, callback: any) => {
        try {
            const tenant = await tenantRepo.findById(call.request.tenant_id);
            if (!tenant) {
                return callback(null, { found: false });
            }
            callback(null, {
                found: true,
                tenant_id: tenant.id,
                name: tenant.name,
                subdomain: tenant.subdomain,
                status: tenant.status,
                is_active: tenant.isActive,
                settings_json: JSON.stringify(tenant.settings),
            });
        } catch (error: any) {
            logger.error('gRPC GetTenantById error', { error: error.message });
            callback({ code: grpc.status.INTERNAL, details: error.message });
        }
    },
    GetMembership: async (call: any, callback: any) => {
        try {
            const { user_id, tenant_id } = call.request;
            const membership = await mapRepo.findByUserAndTenant(user_id, tenant_id);
            if (!membership) {
                return callback(null, { found: false });
            }
            callback(null, {
                found: true,
                membership_id: membership.id,
                user_id: membership.userId,
                tenant_id: membership.tenantId,
                role: membership.role,
                sub_role: membership.subRole ?? '',
                branch_id: membership.branchId ?? '',
            });
        } catch (error: any) {
            logger.error('gRPC GetMembership error', { error: error.message });
            callback({ code: grpc.status.INTERNAL, details: error.message });
        }
    }
};
export const createGrpcServer = (): grpc.Server => {
    const server = new grpc.Server();
    server.addService(tenantProto.tenant.v1.TenantService.service, handlers);
    return server;
};
