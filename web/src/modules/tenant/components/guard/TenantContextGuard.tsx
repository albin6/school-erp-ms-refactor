import { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { getTenantSubdomain, navigateToSubdomain } from '@/utils/subdomain';
import { branchService } from '@/services/branchService';

interface TenantContextGuardProps {
    children: React.ReactNode;
}

export const TenantContextGuard: React.FC<TenantContextGuardProps> = ({ children }) => {
    const subdomain = getTenantSubdomain();
    const [isValidating, setIsValidating] = useState(true);

    useEffect(() => {
        const validateTenant = async () => {
            if (!subdomain) {

                setIsValidating(false);
                return;
            }

            try {

                const response = await branchService.checkSlugAvailability(subdomain);
                const available = response?.available ?? response?.data?.available;
                const exists = response?.exists ?? response?.data?.exists;

                if (available === true || exists === false) {
                    console.warn(`Tenant subdomain '${subdomain}' does not exist. Redirecting to root.`);
                    navigateToSubdomain(null);
                    return;
                }

                setIsValidating(false);
            } catch (error) {
                console.error('Error validating tenant:', error);

                navigateToSubdomain(null);
            }
        };

        validateTenant();
    }, [subdomain]);

    if (isValidating) {
        return (
            <div style={{
                height: '100vh',
                width: '100vw',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: '#f0f2f5'
            }}>
                <Spin size="large" tip="Verifying School..." />
            </div>
        );
    }

    return <>{children}</>;
};
