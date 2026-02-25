import nodemailer from 'nodemailer';
import { config } from '../../config';
import { logger } from '../../config/logger';
let transporter: nodemailer.Transporter;
export const connectSMTP = (): void => {
    transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465,
        auth: {
            user: config.SMTP_USER,
            pass: config.SMTP_PASSWORD,
        },
    });
    logger.info(' SMTP client configured');
};
export const sendEmail = async (to: string, subject: string, html: string): Promise<void> => {
    if (!transporter) throw new Error('SMTP client not connected');
    try {
        const info = await transporter.sendMail({
            from: `"School ERP" <${config.SMTP_FROM}>`,
            to,
            subject,
            html,
        });
        logger.debug('Email sent successfully', { messageId: info.messageId, to });
    } catch (error: any) {
        logger.error('Failed to send email', { to, error: error.message });
        throw error;
    }
};
