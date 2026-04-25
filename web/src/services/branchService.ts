import api from './api';
import { useTenantAuthStore } from '../store/tenantAuthStore';
const getTenantId = () => {
    const tenant = useTenantAuthStore.getState().tenant;
    if (tenant?.id) return tenant.id;
    return '';
};
export interface Branch {
    id: string;
    name: string;
    slug: string;
    address?: string;
    phone?: string;
    email?: string;
    status: 'ACTIVE' | 'BLOCKED';
    created_at: string;
}
export interface CreateBranchDTO {
    name: string;
    slug: string;
    address?: string;
    phone?: string;
    email?: string;
}
export interface UpdateBranchDTO {
    name?: string;
    slug?: string;
    address?: string;
    phone?: string;
    email?: string;
    status?: 'ACTIVE' | 'BLOCKED';
}
export interface BranchQueryParams {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'ACTIVE' | 'BLOCKED';
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}

interface BranchListResult {
    branches: Branch[];
    pagination: {
        page: number;
        limit: number;
        total: number;
    };
    data: Branch[] | { branches?: Branch[]; pagination?: { page?: number; limit?: number; total?: number } };
}

export const branchService = {
    getBranches: async (params: BranchQueryParams = {}) => {
        const tenantId = getTenantId();
        const response = await api.get(`/tenants/${tenantId}/branches`, { params });
        const payload = response.data?.data;
        const branches = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.branches)
                ? payload.branches
                : [];

        const page = payload?.pagination?.page ?? params.page ?? 1;
        const limit = payload?.pagination?.limit ?? params.limit ?? branches.length ?? 0;
        const total = payload?.pagination?.total ?? branches.length;

        return {
            branches,
            pagination: {
                page,
                limit,
                total,
            },
            data: payload ?? branches,
        } satisfies BranchListResult;
    },
    getBranch: async (branchId: string) => {
        const tenantId = getTenantId();
        const response = await api.get(`/tenants/${tenantId}/branches/${branchId}`);
        return response.data.data;
    },
    createBranch: async (data: Partial<Branch>) => {
        const tenantId = getTenantId();
        const response = await api.post(`/tenants/${tenantId}/branches`, data);
        return response.data.data;
    },
    updateBranch: async (branchId: string, data: Partial<Branch>) => {
        const tenantId = getTenantId();
        const response = await api.patch(`/tenants/${tenantId}/branches/${branchId}`, data);
        return response.data.data;
    },
    deleteBranch: async (branchId: string) => {
        const tenantId = getTenantId();
        const response = await api.delete(`/tenants/${tenantId}/branches/${branchId}`);
        return response.data;
    },
    toggleBlock: async (branchId: string) => {
        const tenantId = getTenantId();
        const response = await api.patch(`/tenants/${tenantId}/branches/${branchId}/status`);
        return response.data.data;
    },
    checkSlugAvailability: async (subdomain: string) => {
        const response = await api.get(`/tenants/check-availability`, {
            params: { subdomain }
        });
        return response.data;
    },
    getBranchBySlug: async (slug: string) => {
        const tenantId = getTenantId();
        const response = await api.get(`/tenants/${tenantId}/branches/slug/${slug}`);
        return response.data.data;
    },
    getPublicBranches: async (subdomain: string, search?: string) => {
        const response = await api.get(`/tenants/public/branches`, {
            params: { subdomain, search }
        });
        return response.data.data;
    },
    getPublicBranchBySlug: async (subdomain: string, slug: string) => {
        const response = await api.get(`/tenants/public/branches/slug`, {
            params: { subdomain, slug }
        });
        return response.data.data;
    }
};
