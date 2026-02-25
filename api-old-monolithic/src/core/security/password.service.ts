import bcrypt from "bcryptjs";
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
export const hashPassword = async (password: string): Promise<string> => {
    return await bcrypt.hash(password, SALT_ROUNDS);
};
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
    return await bcrypt.compare(password, hash);
};
export const validatePasswordPolicy = (password: string): { valid: boolean; message?: string } => {
    if (!password || password.length < 8) {
        return { valid: false, message: "Password must be at least 8 characters long." };
    }
    if (!PASSWORD_REGEX.test(password)) {
        return { valid: false, message: "Password must contain uppercase, lowercase, number, and special character." };
    }
    return { valid: true };
};
