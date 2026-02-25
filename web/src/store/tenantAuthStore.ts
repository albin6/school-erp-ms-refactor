import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/services/api';
interface TenantUser {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'STAFF' | 'STUDENT';
    subRole?: string;
    mustResetPassword?: boolean;
}
interface Tenant {
    id: string;
    name: string;
    subdomain: string;
}
interface TenantAuthState {
    user: TenantUser | null;
    tenant: Tenant | null;
    accessToken: string | null;
    isAuthenticated: boolean;
    loginAdmin: (email: string, password: string, tenantId: string) => Promise<void>;
    loginStaff: (email: string, password: string, tenantId: string) => Promise<void>;
    loginStudent: (email: string, password: string, tenantId: string) => Promise<void>;
    logout: (tenantId: string) => Promise<void>;
    setAccessToken: (token: string) => void;
    checkAuth: () => Promise<void>;
    clearAuth: () => void;
}
export const useTenantAuthStore = create<TenantAuthState>()(
    persist(
        (set, get) => ({
            user: null,
            tenant: null,
            accessToken: null,
            isAuthenticated: false,
            loginAdmin: async (email: string, password: string, tenantId: string) => {
                try {
                    const response = await api.post(`/auth/tenant/${tenantId}/admin/login`, {
                        email,
                        password,
                    });
                    const { user, tenant, accessToken } = response.data.data;
                    set({
                        user,
                        tenant,
                        accessToken,
                        isAuthenticated: true,
                    });
                } catch (error: any) {
                    throw new Error(error.response?.data?.message || 'Login failed');
                }
            },
            loginStaff: async (email: string, password: string, tenantId: string) => {
                try {
                    const response = await api.post(`/auth/tenant/${tenantId}/staff/login`, {
                        email,
                        password,
                    });
                    const { user, tenant, accessToken } = response.data.data;
                    set({
                        user,
                        tenant,
                        accessToken,
                        isAuthenticated: true,
                    });
                } catch (error: any) {
                    throw new Error(error.response?.data?.message || 'Login failed');
                }
            },
            loginStudent: async (email: string, password: string, tenantId: string) => {
                try {
                    const response = await api.post(`/auth/tenant/${tenantId}/student/login`, {
                        email,
                        password,
                    });
                    const { user, tenant, accessToken } = response.data.data;
                    set({
                        user,
                        tenant,
                        accessToken,
                        isAuthenticated: true,
                    });
                } catch (error: any) {
                    throw new Error(error.response?.data?.message || 'Login failed');
                }
            },
            checkAuth: async () => {
                try {
                    const { tenant } = get();
                    if (!tenant) return;
                    const response = await api.get(`/auth/tenant/${tenant.id}/me`);
                    const { user } = response.data.data;
                    set({ user, isAuthenticated: true });
                } catch (error) {
                    set({
                        user: null,
                        tenant: null,
                        accessToken: null,
                        isAuthenticated: false,
                    });
                }
            },
            clearAuth: () => {
                set({
                    user: null,
                    tenant: null,
                    accessToken: null,
                    isAuthenticated: false,
                });
            },
            logout: async (tenantId: string) => {
                const { isAuthenticated, tenant } = get();
                if (isAuthenticated && (tenantId || tenant?.subdomain)) {
                    try {
                        const tenantIdentifier = tenantId || tenant?.subdomain;
                        if (tenantIdentifier) {
                            await api.post(`/auth/tenant/${tenantIdentifier}/logout`);
                        }
                    } catch (error) {
                        console.error('Logout API error:', error);
                    }
                }
                set({
                    user: null,
                    tenant: null,
                    accessToken: null,
                    isAuthenticated: false,
                });
            },
            setAccessToken: (token: string) => {
                set({ accessToken: token });
            },
        }),
        {
            name: 'tenant-auth-storage',
            partialize: (state) => ({
                user: state.user,
                tenant: state.tenant,
                accessToken: state.accessToken,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);
