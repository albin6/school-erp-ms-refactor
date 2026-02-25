import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { config } from '../config';
const api = axios.create({
    baseURL: config.API_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});
api.interceptors.request.use(
    async (config) => {
        let token = useAuthStore.getState().accessToken;
        if (!token) {
            const { useTenantAuthStore } = await import('../store/tenantAuthStore');
            const tenantStore = useTenantAuthStore.getState();
            token = tenantStore.accessToken;
            if (tenantStore.tenant?.subdomain) {
                config.headers['x-tenant-subdomain'] = tenantStore.tenant.subdomain;
            }
        }
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const isAuthEndpoint = originalRequest.url?.includes('/login') ||
            originalRequest.url?.includes('/register') ||
            originalRequest.url?.includes('/refresh') ||
            originalRequest.url?.includes('/logout');
        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
            originalRequest._retry = true;
            try {
                const { useTenantAuthStore } = await import('../store/tenantAuthStore');
                const tenantStore = useTenantAuthStore.getState();
                const superAdminStore = useAuthStore.getState();
                let refreshEndpoint = '/auth/refresh';
                let isAuthenticated = false;
                let updateTokenFn: ((token: string) => void) | null = null;
                if (tenantStore.isAuthenticated && tenantStore.tenant?.subdomain) {
                    refreshEndpoint = `/auth/tenant/${tenantStore.tenant.subdomain}/refresh`;
                    isAuthenticated = true;
                    updateTokenFn = tenantStore.setAccessToken;
                }
                else if (superAdminStore.isAuthenticated) {
                    refreshEndpoint = '/auth/refresh';
                    isAuthenticated = true;
                    updateTokenFn = superAdminStore.setAccessToken;
                }
                if (!isAuthenticated || !updateTokenFn) {
                    superAdminStore.clearAuth();
                    tenantStore.clearAuth();
                    return Promise.reject(error);
                }
                const { data } = await api.post(refreshEndpoint);
                const newAccessToken = data.data?.accessToken || data.accessToken;
                if (!newAccessToken) {
                    throw new Error('No access token in refresh response');
                }
                updateTokenFn(newAccessToken);
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
                useAuthStore.getState().clearAuth();
                const { useTenantAuthStore } = await import('../store/tenantAuthStore');
                useTenantAuthStore.getState().clearAuth();
                if (window.location.hostname.includes('sadmin')) {
                    window.location.href = '/login';
                } else {
                    window.location.href = '/';
                }
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);
export default api;
