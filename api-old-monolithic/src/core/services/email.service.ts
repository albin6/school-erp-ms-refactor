import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
class EmailService {
    private transporter: Transporter;
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            },
        });
    }
    async sendTenantAdminCredentials(
        email: string,
        tenantName: string,
        subdomain: string,
        temporaryPassword: string
    ): Promise<void> {
        const loginUrl = `${process.env.PROTOCOL || 'http'}:
        const mailOptions = {
            from: process.env.SMTP_FROM || 'noreply@schoolmanagement.com',
            to: email,
            subject: `Welcome to ${tenantName} - Your Admin Credentials`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                        .credentials { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #4F46E5; }
                        .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .warning { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }
                        code { background: #e5e7eb; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Welcome to ${tenantName}!</h1>
                        </div>
                        <div class="content">
                            <p>Hello,</p>
                            <p>Your school's admin account has been created. Below are your login credentials:</p>
                            <div class="credentials">
                                <p><strong>Email:</strong> ${email}</p>
                                <p><strong>Temporary Password:</strong> <code>${temporaryPassword}</code></p>
                                <p><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
                            </div>
                            <div class="warning">
                                <strong>️ Important Security Notice:</strong>
                                <p>For security reasons, you will be required to change this password upon your first login. Please keep this email secure and delete it after changing your password.</p>
                            </div>
                            <a href="${loginUrl}" class="button">Login to Admin Portal</a>
                            <p>If you have any questions or need assistance, please contact support.</p>
                            <p>Best regards,<br>School Management Team</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
Welcome to ${tenantName}!
Your school's admin account has been created. Below are your login credentials:
Email: ${email}
Temporary Password: ${temporaryPassword}
Login URL: ${loginUrl}
IMPORTANT: For security reasons, you will be required to change this password upon your first login.
Best regards,
School Management Team
            `,
        };
        try {
            await this.transporter.sendMail(mailOptions);
            console.log(` Credentials email sent to ${email}`);
        } catch (error) {
            console.error(' Failed to send email:', error);
            throw new Error('Failed to send credentials email');
        }
    }
    async sendOTPEmail(email: string, otp: string, expiresAt: Date): Promise<void> {
        const expiryMinutes = Math.floor((expiresAt.getTime() - Date.now()) / 60000);
        const mailOptions = {
            from: process.env.SMTP_FROM || 'noreply@schoolmanagement.com',
            to: email,
            subject: 'Password Reset OTP',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #1890ff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                        .otp-box { background: white; border: 2px solid #1890ff; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; border-radius: 5px; }
                        .warning { color: #ff4d4f; font-size: 14px; margin-top: 20px; }
                        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Password Reset Request</h1>
                        </div>
                        <div class="content">
                            <p>Hello,</p>
                            <p>You have requested to reset your password. Please use the following One-Time Password (OTP) to proceed:</p>
                            <div class="otp-box">${otp}</div>
                            <p><strong>This OTP will expire in ${expiryMinutes} minutes.</strong></p>
                            <p>If you did not request this password reset, please ignore this email and your password will remain unchanged.</p>
                            <div class="warning">
                                ️ Never share this OTP with anyone. Our team will never ask for your OTP.
                            </div>
                        </div>
                        <div class="footer">
                            <p>© 2026 School Management System. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
Password Reset Request
You have requested to reset your password. Please use the following OTP:
${otp}
This OTP will expire in ${expiryMinutes} minutes.
If you did not request this password reset, please ignore this email.
Never share this OTP with anyone.
            `,
        };
        try {
            await this.transporter.sendMail(mailOptions);
            console.log(` OTP email sent to ${email}`);
        } catch (error) {
            console.error(' Failed to send OTP email:', error);
            throw new Error('Failed to send OTP email');
        }
    }
    async sendPasswordResetConfirmation(email: string, tenantName: string): Promise<void> {
        const mailOptions = {
            from: process.env.SMTP_FROM || 'noreply@schoolmanagement.com',
            to: email,
            subject: 'Password Successfully Changed',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1> Password Changed Successfully</h1>
                        </div>
                        <div class="content">
                            <p>Hello,</p>
                            <p>Your password for ${tenantName} has been successfully changed.</p>
                            <p>If you did not make this change, please contact support immediately.</p>
                            <p>Best regards,<br>School Management Team</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };
        try {
            await this.transporter.sendMail(mailOptions);
            console.log(` Password reset confirmation sent to ${email}`);
        } catch (error) {
            console.error(' Failed to send confirmation email:', error);
        }
    }
    async verifyConnection(): Promise<boolean> {
        try {
            await this.transporter.verify();
            console.log(' Email service is ready');
            return true;
        } catch (error) {
            console.error(' Email service configuration error:', error);
            return false;
        }
    }
}
export const emailService = new EmailService();
