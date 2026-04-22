import { Tenant } from '../aggregates/Tenant';
import { Membership } from '../aggregates/Membership';
export interface ITenantRepository {
    findById(id: string): Promise<Tenant | null>;
    findBySubdomain(subdomain: string): Promise<Tenant | null>;
    findByAnySubdomain(subdomain: string): Promise<Tenant | null>;
    listPaginated(page: number, limit: number): Promise<{ tenants: Tenant[]; total: number }>;
    existsBySubdomain(subdomain: string): Promise<boolean>;
    save(tenant: Tenant): Promise<Tenant>;
    update(tenant: Tenant): Promise<Tenant>;
    delete(id: string): Promise<void>;
}
export interface IMembershipRepository {
    findById(id: string): Promise<Membership | null>;
    findByUserAndTenant(userId: string, tenantId: string): Promise<Membership | null>;
    findPrincipalByBranch(tenantId: string, branchId: string): Promise<Membership | null>;
    save(membership: Membership): Promise<Membership>;
    update(membership: Membership): Promise<Membership>;
    delete(id: string): Promise<void>;
}
