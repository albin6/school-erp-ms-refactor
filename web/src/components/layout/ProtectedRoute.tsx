import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Spin } from 'antd';

export const ProtectedRoute = () => {
    const { isAuthenticated, checkAuth } = useAuthStore();
    const location = useLocation();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const verifyAuth = async () => {
            if (isAuthenticated) {
                await checkAuth();
            }
            setIsLoading(false);
        };
        verifyAuth();
    }, [checkAuth, isAuthenticated]);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" tip="Verifying session..." />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
};
