import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { config } from '../../config';
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
export const validateToken = (token: string): Promise<TokenPayload> => {
    return new Promise((resolve, reject) => {
        const deadline = new Date(Date.now() + 5000); // 5 second timeout
        client.ValidateToken({ token }, { deadline }, (error: any, response: any) => {
            if (error) return reject(new Error('Identity Service Unavailable'));
            if (!response.valid) return reject(new Error(response.error || 'Invalid Token'));
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
