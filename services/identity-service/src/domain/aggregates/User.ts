import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../errors/AppError';
export interface UserProps {
    id?: string;
    email: string;
    passwordHash: string;
    name: string;
    isSuperAdmin?: boolean;
    failedLoginAttempts?: number;
    lockoutUntil?: Date | null;
    lastLoginAt?: Date | null;
    isActive?: boolean;
    mustResetPassword?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}
export class User {
    public readonly id: string;
    public email: string;
    public passwordHash: string;
    public name: string;
    public isSuperAdmin: boolean;
    public failedLoginAttempts: number;
    public lockoutUntil: Date | null;
    public lastLoginAt: Date | null;
    public isActive: boolean;
    public mustResetPassword: boolean;
    public readonly createdAt: Date;
    public updatedAt: Date;
    private static readonly MAX_FAILED_ATTEMPTS = 5;
    private static readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000;
    constructor(props: UserProps) {
        this.id = props.id ?? uuidv4();
        this.email = props.email.toLowerCase().trim();
        this.passwordHash = props.passwordHash;
        this.name = props.name.trim();
        this.isSuperAdmin = props.isSuperAdmin ?? false;
        this.failedLoginAttempts = props.failedLoginAttempts ?? 0;
        this.lockoutUntil = props.lockoutUntil ?? null;
        this.lastLoginAt = props.lastLoginAt ?? null;
        this.isActive = props.isActive ?? true;
        this.mustResetPassword = props.mustResetPassword ?? false;
        this.createdAt = props.createdAt ?? new Date();
        this.updatedAt = props.updatedAt ?? new Date();
    }
    isLockedOut(): boolean {
        return this.lockoutUntil !== null && this.lockoutUntil > new Date();
    }
    recordFailedLogin(): void {
        this.failedLoginAttempts += 1;
        if (this.failedLoginAttempts >= User.MAX_FAILED_ATTEMPTS) {
            this.lockoutUntil = new Date(Date.now() + User.LOCKOUT_DURATION_MS);
        }
        this.updatedAt = new Date();
    }
    recordSuccessfulLogin(): void {
        this.failedLoginAttempts = 0;
        this.lockoutUntil = null;
        this.lastLoginAt = new Date();
        this.updatedAt = new Date();
    }
    activate(): void {
        if (this.isActive) throw new AppError('User is already active', 400);
        this.isActive = true;
        this.updatedAt = new Date();
    }
    deactivate(): void {
        if (!this.isActive) throw new AppError('User is already inactive', 400);
        this.isActive = false;
        this.updatedAt = new Date();
    }
    updatePassword(newPasswordHash: string): void {
        this.passwordHash = newPasswordHash;
        this.mustResetPassword = false;
        this.failedLoginAttempts = 0;
        this.lockoutUntil = null;
        this.updatedAt = new Date();
    }
    assertCanLogin(): void {
        if (!this.isActive) {
            throw new AppError('Your account has been deactivated. Contact support.', 403);
        }
        if (this.isLockedOut()) {
            throw new AppError('Account is temporarily locked. Try again later.', 429);
        }
    }
}
