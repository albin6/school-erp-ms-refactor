import bcrypt from 'bcrypt';
import { AppError } from '../../domain/errors/AppError';
const SALT_ROUNDS = 12;
export const hashPassword = async (password: string): Promise<string> => {
    return bcrypt.hash(password, SALT_ROUNDS);
};
export const verifyPassword = async (plain: string, hash: string): Promise<boolean> => {
    return bcrypt.compare(plain, hash);
};
export const generateTemporaryPassword = (): string => {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};
export const validatePasswordStrength = (password: string): void => {
    if (password.length < 8) {
        throw new AppError('Password must be at least 8 characters', 400);
    }
};
