import { config } from '../config';
export const getSubdomain = (): string | null => {
    const hostname = window.location.hostname;
    const rootDomain = config.ROOT_DOMAIN.split(':')[0];
    if (hostname === rootDomain || hostname === '127.0.0.1') {
        return null;
    }
    const parts = hostname.split('.');
    const rootParts = rootDomain.split('.');
    if (rootDomain === 'localhost' && !hostname.includes('localhost')) {
        const hostParts = hostname.split('.');
        if (hostParts.length === 2) {
            return null;
        }
    }
    if (parts.length > rootParts.length) {
        if (parts[0] === 'www') {
            return null;
        }
        return parts[0];
    }
    return null;
};
export const isRootDomain = (): boolean => {
    return getSubdomain() === null;
};
export const isSuperAdminDomain = (): boolean => {
    return getSubdomain() === 'sadmin';
};
export const isTenantDomain = (): boolean => {
    const subdomain = getSubdomain();
    return subdomain !== null && subdomain !== 'sadmin';
};
export const getTenantSubdomain = (): string | null => {
    const subdomain = getSubdomain();
    if (subdomain && subdomain !== 'sadmin') {
        return subdomain;
    }
    return null;
};
export const buildSubdomainUrl = (subdomain: string | null, path: string = '/'): string => {
    const protocol = config.PROTOCOL;
    const rootDomain = config.ROOT_DOMAIN;
    
    if (!subdomain) {
        return `${protocol}://${rootDomain}${path}`;
    }
    return `${protocol}://${subdomain}.${rootDomain}${path}`;
};
export const navigateToSubdomain = (subdomain: string | null, path: string = '/') => {
    window.location.href = buildSubdomainUrl(subdomain, path);
};
