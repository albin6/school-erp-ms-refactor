import nodemailer from 'nodemailer';
import { config } from '../../config';
import { logger } from '../../config/logger';
let transporter: nodemailer.Transporter;
let smtpDeliveryEnabled = false;
const toMessageId = (idempotencyKey: string): string => {
    const safeKey = idempotencyKey.replace(/[^a-zA-Z0-9.-]/g, '');
    return `<${safeKey}@school-erp.local>`;
};
export const connectSMTP = (): void => {
    smtpDeliveryEnabled = Boolean(config.SMTP_USER && config.SMTP_PASSWORD);
    if (!smtpDeliveryEnabled && config.NODE_ENV !== 'production') {
        logger.warn('SMTP credentials are not configured; email delivery will be simulated in non-production.');
        return;
    }
    if (!smtpDeliveryEnabled) {
        throw new Error('SMTP_USER and SMTP_PASSWORD are required in production');
    }
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
    if (!smtpDeliveryEnabled) {
        const simulatedMessageId = toMessageId(idempotencyKey);
        logger.info('Email delivery simulated', { to, subject, messageId: simulatedMessageId });
        return simulatedMessageId;
    }
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
