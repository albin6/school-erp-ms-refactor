import nodemailer from 'nodemailer';
import { config } from '../../config';
import { logger } from '../../config/logger';
let transporter: nodemailer.Transporter;
const toMessageId = (idempotencyKey: string): string => {
    const safeKey = idempotencyKey.replace(/[^a-zA-Z0-9.-]/g, '');
    return `<${safeKey}@school-erp.local>`;
};
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
export const sendEmail = async (to: string, subject: string, html: string, idempotencyKey: string): Promise<string> => {
    if (!transporter) throw new Error('SMTP client not connected');
    try {
        const info = await transporter.sendMail({
            from: `"School ERP" <${config.SMTP_FROM}>`,
            to,
            subject,
            html,
            messageId: toMessageId(idempotencyKey),
            headers: {
                'X-Idempotency-Key': idempotencyKey,
            },
        });
        logger.debug('Email sent successfully', { messageId: info.messageId, to });
        return info.messageId;
    } catch (error: any) {
        logger.error('Failed to send email', { to, error: error.message });
        throw error;
    }
};
