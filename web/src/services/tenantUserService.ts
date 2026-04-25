import api from './api';
import { useTenantAuthStore } from '../store/tenantAuthStore';
const getTenantId = () => {
    const tenant = useTenantAuthStore.getState().tenant;
    if (tenant?.id) return tenant.id;
    return '';
};
export interface TenantUser {
    id: string;
    user_id: string;
    tenant_id: string;
    role: 'ADMIN' | 'STAFF' | 'STUDENT';
    sub_role?: string;
    branch_id?: string;
    user: {
        id: string;
        name: string;
        email: string;
        is_active: boolean;
        last_login_at?: string;
    };
    branch?: {
        id: string;
        name: string;
    };
    created_at: string;
}
export interface UserQueryParams {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    sub_role?: string;
    branch_id?: string;
    status?: 'ACTIVE' | 'BLOCKED';
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}

interface TenantUserListResult {
    success: boolean;
    data: {
        users: TenantUser[];
        pagination: {
            page: number;
            limit: number;
            total: number;
        };
    };
}

export const tenantUserService = {
    getUsers: async (params: UserQueryParams = {}) => {
        const tenantId = getTenantId();
        const response = await api.get(`/tenants/${tenantId}/users`, { params });
        const payload = response.data?.data;
        const users = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.users)
                ? payload.users
                : [];

        const page = payload?.pagination?.page ?? params.page ?? 1;
        const limit = payload?.pagination?.limit ?? params.limit ?? users.length ?? 0;
        const total = payload?.pagination?.total ?? users.length;

        return {
            ...response.data,
            data: {
                users,
                pagination: {
                    page,
                    limit,
                    total,
                },
            },
        } satisfies TenantUserListResult;
    },
    createUser: async (data: any) => {
        const tenantId = getTenantId();
        const response = await api.post(`/tenants/${tenantId}/users`, data);
        return response.data;
    },
    updateUser: async (userId: string, data: any) => {
        const tenantId = getTenantId();
        const response = await api.patch(`/tenants/${tenantId}/users/${userId}`, data);
        return response.data;
    },
    deleteUser: async (userId: string) => {
        const tenantId = getTenantId();
        const response = await api.delete(`/tenants/${tenantId}/users/${userId}`);
        return response.data;
    }
};
