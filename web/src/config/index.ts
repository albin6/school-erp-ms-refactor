export const config = {
    API_URL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
    ROOT_DOMAIN: import.meta.env.VITE_ROOT_DOMAIN || 'localhost:5173',
    PROTOCOL: import.meta.env.VITE_PROTOCOL || 'http',
};
