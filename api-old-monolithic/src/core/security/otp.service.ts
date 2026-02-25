import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { PasswordResetToken } from "../../infrastructure/database/models";
export class OTPService {
    private static readonly OTP_LENGTH = 6;
    private static readonly OTP_EXPIRY_MINUTES = 5;
    private static readonly MAX_ATTEMPTS = 5;
    static generateOTP(): string {
        const otp = crypto.randomInt(100000, 999999).toString();
        return otp;
    }
    static async hashOTP(otp: string): Promise<string> {
        const saltRounds = 10;
        return await bcrypt.hash(otp, saltRounds);
    }
    static async verifyOTP(otp: string, hash: string): Promise<boolean> {
        return await bcrypt.compare(otp, hash);
    }
    static async createPasswordResetOTP(email: string, ipAddress: string | null = null): Promise<{
        otp: string;
        expiresAt: Date;
    }> {
        await PasswordResetToken.update(
            { used_at: new Date() },
            {
                where: {
                    email,
                    used_at: null,
                    expires_at: { [Op.gt]: new Date() }
                }
            }
        );
        const otp = this.generateOTP();
        const otpHash = await this.hashOTP(otp);
        const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);
        await PasswordResetToken.create({
            email,
            otp_hash: otpHash,
            expires_at: expiresAt,
            attempts: 0,
            max_attempts: this.MAX_ATTEMPTS,
            ip_address: ipAddress,
        });
        if (process.env.NODE_ENV === 'development') {
            console.log(` OTP for ${email}: ${otp} (expires at ${expiresAt.toISOString()})`);
        }
        return { otp, expiresAt };
    }
    static async validateOTP(email: string, otp: string): Promise<{
        valid: boolean;
        message: string;
        resetToken?: string;
    }> {
        const tokenRecord = await PasswordResetToken.findOne({
            where: {
                email,
                used_at: null,
                expires_at: { [Op.gt]: new Date() }
            },
            order: [['created_at', 'DESC']]
        });
        if (!tokenRecord) {
            return {
                valid: false,
                message: 'No active OTP found or OTP has expired'
            };
        }
        if (tokenRecord.attempts >= tokenRecord.max_attempts) {
            return {
                valid: false,
                message: 'Maximum verification attempts exceeded. Please request a new OTP.'
            };
        }
        const isValid = await this.verifyOTP(otp, tokenRecord.otp_hash);
        tokenRecord.attempts += 1;
        await tokenRecord.save();
        if (!isValid) {
            const attemptsLeft = tokenRecord.max_attempts - tokenRecord.attempts;
            return {
                valid: false,
                message: `Invalid OTP. ${attemptsLeft} attempt(s) remaining.`
            };
        }
        tokenRecord.used_at = new Date();
        await tokenRecord.save();
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = await bcrypt.hash(resetToken, 10);
        const resetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await PasswordResetToken.create({
            email,
            otp_hash: resetTokenHash,
            expires_at: resetExpiresAt,
            attempts: 0,
            max_attempts: 1,
            ip_address: tokenRecord.ip_address,
        });
        return {
            valid: true,
            message: 'OTP verified successfully',
            resetToken
        };
    }
    static async getOTPStatus(email: string): Promise<{
        hasActiveOTP: boolean;
        expiresAt: Date | null;
        attemptsRemaining: number;
    }> {
        const tokenRecord = await PasswordResetToken.findOne({
            where: {
                email,
                used_at: null,
                expires_at: { [Op.gt]: new Date() }
            },
            order: [['created_at', 'DESC']]
        });
        if (!tokenRecord) {
            return {
                hasActiveOTP: false,
                expiresAt: null,
                attemptsRemaining: 0
            };
        }
        return {
            hasActiveOTP: true,
            expiresAt: tokenRecord.expires_at,
            attemptsRemaining: tokenRecord.max_attempts - tokenRecord.attempts
        };
    }
    static async validateResetToken(email: string, resetToken: string): Promise<boolean> {
        const tokenRecord = await PasswordResetToken.findOne({
            where: {
                email,
                used_at: null,
                expires_at: { [Op.gt]: new Date() },
                attempts: 0
            },
            order: [['created_at', 'DESC']]
        });
        if (!tokenRecord) {
            return false;
        }
        const isValid = await bcrypt.compare(resetToken, tokenRecord.otp_hash);
        if (isValid) {
            tokenRecord.used_at = new Date();
            await tokenRecord.save();
        }
        return isValid;
    }
    static async cleanupExpiredOTPs(): Promise<number> {
        const result = await PasswordResetToken.destroy({
            where: {
                expires_at: { [Op.lt]: new Date() }
            }
        });
        return result;
    }
}
