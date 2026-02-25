import api from '@/services/api';
export interface HealthStatus {
    server: string;
    database: string;
    redis: string;
    timestamp: string;
}
export const checkHealth = async (): Promise<HealthStatus> => {
    const response = await api.get<HealthStatus>('/health');
    return response.data;
};
