import nodemailer from 'nodemailer';
import { config } from '../../config';
import { logger } from '../../config/logger';

let transporter: nodemailer.Transporter | null = null;

const getTransporter = (): nodemailer.Transporter => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: config.SMTP_HOST,
            port: config.SMTP_PORT,
            secure: config.SMTP_PORT === 465,
            auth: config.SMTP_USER && config.SMTP_PASSWORD ? {
                user: config.SMTP_USER,
                pass: config.SMTP_PASSWORD,
            } : undefined,
        });
    }

    return transporter;
};

export const sendPasswordResetOtpEmail = async (to: string, otp: string): Promise<void> => {
    if (!config.SMTP_USER || !config.SMTP_PASSWORD) {
        console.log(`[DEV OTP] Password reset OTP for ${to}: ${otp}`);
        logger.warn('SMTP credentials are not configured; password reset OTP logged for local development', {
            email: to,
            otp,
        });
        return;
    }

    await getTransporter().sendMail({
        from: `"School ERP" <${config.SMTP_FROM}>`,
        to,
        subject: 'Your School ERP password reset OTP',
        html: `
          <h2>Password Reset OTP</h2>
          <p>Your one-time password is: <b>${otp}</b></p>
          <p>This code expires in 10 minutes.</p>
          <p>If you did not request this, you can ignore this email.</p>
        `,
    });

    logger.info('Password reset OTP email sent', { email: to });
};
