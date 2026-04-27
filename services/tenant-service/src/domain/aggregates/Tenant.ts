import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../errors/AppError';
export type TenantStatus = 'PROVISIONING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'FAILED';
export interface TenantProps {
    id?: string;
    name: string;
    subdomain: string;
    domain?: string | null;
    status?: TenantStatus;
    settings?: Record<string, any>;
    isActive?: boolean;
    createdBy?: string;
    createdAt?: Date;
    updatedAt?: Date;
}
export class Tenant {
    public readonly id: string;
    public name: string;
    public subdomain: string;
    public domain: string | null;
    public status: TenantStatus;
    public settings: Record<string, any>;
    public isActive: boolean;
    public readonly createdBy: string;
    public readonly createdAt: Date;
    public updatedAt: Date;
    constructor(props: TenantProps) {
        this.id = props.id ?? uuidv4();
        this.name = props.name.trim();
        this.subdomain = props.subdomain.toLowerCase().trim();
        this.domain = props.domain ?? null;
        this.status = props.status ?? 'ACTIVE';
        this.settings = props.settings ?? {};
        this.isActive = props.isActive ?? true;
        this.createdBy = props.createdBy ?? '';
        this.createdAt = props.createdAt ?? new Date();
        this.updatedAt = props.updatedAt ?? new Date();
        this.validate();
    }
    private validate(): void {
        if (!this.name) throw new AppError('Tenant name is required', 400);
        if (!this.subdomain.match(/^[a-z0-9-]+$/)) {
            throw new AppError('Subdomain can only contain lowercase letters, numbers, and hyphens', 400);
        }
    }
    updateSettings(newSettings: Record<string, any>): void {
        this.settings = { ...this.settings, ...newSettings };
        this.updatedAt = new Date();
    }
    suspend(): void {
        if (this.status === 'SUSPENDED') throw new AppError('Tenant is already suspended', 400);
        this.status = 'SUSPENDED';
        this.isActive = false;
        this.updatedAt = new Date();
    }
    activate(): void {
        if (this.status === 'ACTIVE') throw new AppError('Tenant is already active', 400);
        this.status = 'ACTIVE';
        this.isActive = true;
        this.updatedAt = new Date();
    }
    failProvisioning(reason: string): void {
        this.status = 'FAILED';
        this.isActive = false;
        this.updateSettings({
            provisioningError: reason,
            provisioningFailedAt: new Date().toISOString(),
        });
    }
}
