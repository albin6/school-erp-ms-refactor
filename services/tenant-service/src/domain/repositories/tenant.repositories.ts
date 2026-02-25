import { Tenant } from '../aggregates/Tenant';
import { Membership } from '../aggregates/Membership';
export interface ITenantRepository {
    findById(id: string): Promise<Tenant | null>;
    findBySubdomain(subdomain: string): Promise<Tenant | null>;
    save(tenant: Tenant): Promise<Tenant>;
    update(tenant: Tenant): Promise<Tenant>;
}
export interface IMembershipRepository {
    findById(id: string): Promise<Membership | null>;
    findByUserAndTenant(userId: string, tenantId: string): Promise<Membership | null>;
    findPrincipalByBranch(tenantId: string, branchId: string): Promise<Membership | null>;
    save(membership: Membership): Promise<Membership>;
    update(membership: Membership): Promise<Membership>;
    delete(id: string): Promise<void>;
}
