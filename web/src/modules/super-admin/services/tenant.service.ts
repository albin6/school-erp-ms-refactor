import api from '@/services/api';
import type { CreateTenantDTO, UpdateTenantDTO, TenantQueryDTO } from '../types/tenant.types';
export const tenantService = {
    async getTenants(params?: Partial<TenantQueryDTO>) {
        const response = await api.get('/tenants', { params });
        return response.data;
    },
    async getTenantById(id: string) {
        const response = await api.get(`/tenants/${id}`);
        return response.data;
    },
    async checkAvailability(subdomain: string, excludeId?: string) {
        const response = await api.get('/tenants/check-availability', {
            params: { subdomain, excludeId }
        });
        return response.data;
    },
    async createTenant(data: CreateTenantDTO) {
        const response = await api.post('/tenants', data);
        return response.data;
    },
    async updateTenant(id: string, data: UpdateTenantDTO) {
        const response = await api.put(`/tenants/${id}`, data);
        return response.data;
    },
    async deleteTenant(id: string) {
        const response = await api.delete(`/tenants/${id}`);
        return response.data;
    },
    async blockTenant(id: string) {
        const response = await api.patch(`/tenants/${id}/block`);
        return response.data;
    },
    async unblockTenant(id: string) {
        const response = await api.patch(`/tenants/${id}/unblock`);
        return response.data;
    },
    async getTenantUsers(id: string, params?: { page?: number; limit?: number; role?: string; branch_id?: string; search?: string; status?: string }) {
        const response = await api.get(`/tenants/${id}/users`, { params });
        return response.data;
    },
    async getTenantBranches(id: string, params?: { page?: number; limit?: number; search?: string; status?: string }) {
        const response = await api.get(`/tenants/${id}/branches`, { params });
        return response.data;
    },
};
