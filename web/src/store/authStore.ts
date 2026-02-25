import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '@/modules/auth/services/auth.service';
export interface User {
    id: string;
    email: string;
    name: string;
    is_super_admin: boolean;
}
interface AuthState {
    user: User | null;
    accessToken: string | null;
    isAuthenticated: boolean;
    login: (user: User, accessToken: string) => void;
    logout: () => Promise<void>;
    logoutAll: () => Promise<void>;
    setAccessToken: (token: string) => void;
    checkAuth: () => Promise<void>;
    clearAuth: () => void;
}
export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            login: (user, accessToken) => set({ user, accessToken, isAuthenticated: true }),
            logout: async () => {
                try {
                    await authService.logout();
                } catch (error) {
                    console.error('Logout failed:', error);
                } finally {
                    set({ user: null, accessToken: null, isAuthenticated: false });
                }
            },
            logoutAll: async () => {
                try {
                    await authService.logoutAll();
                } catch (error) {
                    console.error('Logout all failed:', error);
                    throw error;
                } finally {
                    set({ user: null, accessToken: null, isAuthenticated: false });
                }
            },
            setAccessToken: (accessToken) => set({ accessToken }),
            checkAuth: async () => {
                try {
                    const response = await authService.getCurrentUser();
                    set({ user: response.data.user, isAuthenticated: true });
                } catch (error) {
                    set({ user: null, accessToken: null, isAuthenticated: false });
                }
            },
            clearAuth: () => {
                set({ user: null, accessToken: null, isAuthenticated: false });
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
        }
    )
);
