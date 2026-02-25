export interface Tenant {
    id: string;
    name: string;
    subdomain: string;
    domain?: string;
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    settings?: Record<string, any>;
    is_active: boolean;
    created_by?: string;
    created_at: string;
    updated_at: string;
}
export interface CreateTenantDTO {
    name: string;
    subdomain: string;
    admin_email: string;
    domain?: string;
    settings?: Record<string, any>;
}
export interface UpdateTenantDTO {
    name?: string;
    domain?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    settings?: Record<string, any>;
    is_active?: boolean;
}
export interface TenantQueryDTO {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    sortBy?: 'name' | 'created_at' | 'subdomain';
    sortOrder?: 'asc' | 'desc';
}
export interface TenantUser {
    id: string;
    user_id: string;
    tenant_id: string;
    role: string;
    sub_role?: string;
    user: {
        id: string;
        email: string;
        name: string;
        is_active: boolean;
    };
}
