import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useTenantAuthStore } from '@/store/tenantAuthStore';
import { Spin } from 'antd';

interface TenantProtectedRouteProps {
    allowedRoles?: Array<'ADMIN' | 'STAFF' | 'STUDENT'>;
    allowedSubRoles?: string[];
    children?: React.ReactNode;
}

export const TenantProtectedRoute = ({ allowedRoles, allowedSubRoles, children }: TenantProtectedRouteProps) => {
    const { isAuthenticated, user, checkAuth } = useTenantAuthStore();
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
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '1rem' }}>
                <Spin size="large" />
                <div style={{ color: '#6b7280' }}>Verifying session...</div>
            </div>
        );
    }

    if (!isAuthenticated || !user) {

        const path = window.location.pathname;
        if (path.startsWith('/admin')) {
            return <Navigate to="/admin" replace />;
        } else if (path.startsWith('/staff')) {
            return <Navigate to="/staff" replace />;
        } else {
            return <Navigate to="/" replace />;
        }
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />;
    }

    if (allowedSubRoles && user.subRole && !allowedSubRoles.includes(user.subRole)) {
        return <Navigate to="/unauthorized" replace />;
    }

    return children ? <>{children}</> : <Outlet />;
};
