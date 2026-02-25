import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../errors/AppError';
export type Role = 'ADMIN' | 'STAFF' | 'STUDENT';
export type SubRole = 'PRINCIPAL' | 'TEACHER' | 'OFFICE_STAFF' | 'OFFICE_ASSISTANT';
export interface MembershipProps {
    id?: string;
    userId: string;
    tenantId: string;
    branchId?: string | null;
    role: Role;
    subRole?: SubRole | null;
    createdAt?: Date;
    updatedAt?: Date;
}
export class Membership {
    public readonly id: string;
    public readonly userId: string;
    public readonly tenantId: string;
    public branchId: string | null;
    public role: Role;
    public subRole: SubRole | null;
    public readonly createdAt: Date;
    public updatedAt: Date;
    constructor(props: MembershipProps) {
        this.id = props.id ?? uuidv4();
        this.userId = props.userId;
        this.tenantId = props.tenantId;
        this.branchId = props.branchId ?? null;
        this.role = props.role;
        this.subRole = props.subRole ?? null;
        this.createdAt = props.createdAt ?? new Date();
        this.updatedAt = props.updatedAt ?? new Date();
        this.validate();
    }
    private validate(): void {
        if (!this.userId) throw new AppError('User ID is required', 400);
        if (!this.tenantId) throw new AppError('Tenant ID is required', 400);
        if (this.role !== 'ADMIN' && !this.branchId) {
            throw new AppError('Branch assignment is required for STAFF and STUDENT roles', 400);
        }
        if (this.role === 'ADMIN' && this.subRole) {
            throw new AppError('ADMIN role cannot have a subRole', 400);
        }
    }
    updateRole(role: Role, subRole?: SubRole | null, branchId?: string | null): void {
        this.role = role;
        this.subRole = subRole ?? null;
        this.branchId = branchId ?? null;
        this.updatedAt = new Date();
        this.validate();
    }
}
