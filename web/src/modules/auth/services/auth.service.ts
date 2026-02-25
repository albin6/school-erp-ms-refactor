import api from '@/services/api';
export const authService = {
    async logout() {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        }
    },
    async logoutAll() {
        try {
            const response = await api.post('/auth/logout-all');
            return response.data;
        } catch (error) {
            console.error('Logout all error:', error);
            throw error;
        }
    },
    async getCurrentUser() {
        const response = await api.get('/auth/me');
        return response.data;
    }
};
