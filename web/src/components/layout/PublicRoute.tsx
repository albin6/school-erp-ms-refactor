import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useTenantAuthStore } from '@/store/tenantAuthStore';

interface PublicRouteProps {
    type: 'admin' | 'tenant';
    children?: React.ReactNode;
}

export const PublicRoute = ({ type, children }: PublicRouteProps) => {
    const authStore = useAuthStore();
    const tenantAuthStore = useTenantAuthStore();
    const params = useParams();
    const slug = params.slug;

    if (type === 'admin') {
        if (authStore.isAuthenticated) {
            return <Navigate to="/dashboard" replace />;
        }
    } else if (type === 'tenant') {
        if (tenantAuthStore.isAuthenticated && tenantAuthStore.user) {
            if (tenantAuthStore.user.role === 'ADMIN') {
                return <Navigate to="/admin/dashboard" replace />;
            } else if (tenantAuthStore.user.role === 'STAFF') {
                
                if (slug) {
                    const subRole = tenantAuthStore.user.subRole?.toLowerCase().replace('_', '-') || 'teacher';
                    return <Navigate to={`/${slug}/staff/${subRole}`} replace />;
                }
                
                return <Navigate to={`/`} replace />;
            } else {
                
                if (slug) {
                    return <Navigate to={`/${slug}`} replace />;
                }
                return <Navigate to="/" replace />;
            }
        }
    }

    return children ? <>{children}</> : <Outlet />;
};
