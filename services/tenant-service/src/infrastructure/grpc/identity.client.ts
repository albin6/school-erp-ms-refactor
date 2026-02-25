import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { config } from '../../config';
import { AppError } from '../../domain/errors/AppError';
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
export const validateTokenGrpc = (token: string): Promise<TokenValidationResult> => {
    return new Promise((resolve, reject) => {
        client.ValidateToken({ token }, (error: grpc.ServiceError | null, response: any) => {
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
