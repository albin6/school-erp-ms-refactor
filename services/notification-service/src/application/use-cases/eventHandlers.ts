import { NotificationLogRepository } from '../../infrastructure/database/NotificationLogRepository';
import { sendEmail } from '../../infrastructure/email/smtp.client';
import { logger } from '../../config/logger';
const logRepo = new NotificationLogRepository();
export const processTenantCreatedEvent = async (event: any): Promise<void> => {
    const { eventId, payload } = event;
    const { name, adminEmail, subdomain } = payload;
    const isNew = await logRepo.claimEventProcessing(eventId, 'tenant.created', adminEmail, 'EMAIL');
    if (!isNew) {
        logger.info(`Skipping duplicate email for event ${eventId}`);
        return;
    }
    const subject = `Welcome to School ERP - ${name}`;
    const html = `
    <h2>Welcome to School ERP!</h2>
    <p>Your tenant <b>${name}</b> has been provisioned.</p>
    <p>You can access your portal at: <a href="http://${subdomain}.localhost:5173">http://${subdomain}.localhost:5173</a></p>
    <p>Your super-admin credentials will arrive in a separate email shortly.</p>
  `;
    try {
        await sendEmail(adminEmail, subject, html);
        await logRepo.markEventProcessed(eventId, adminEmail, 'EMAIL', 'SUCCESS');
        logger.info(`Tenant created email sent to ${adminEmail}`);
    } catch (error: any) {
        await logRepo.markEventProcessed(eventId, adminEmail, 'EMAIL', 'FAILED', error.message);
        throw error;
    }
};
export const processIdentityUserCreatedEvent = async (event: any): Promise<void> => {
    const { eventId, payload } = event;
    const { email, name, temporaryPassword } = payload;
    const isNew = await logRepo.claimEventProcessing(eventId, 'identity.user.created', email, 'EMAIL');
    if (!isNew) {
        logger.info(`Skipping duplicate credentials email for event ${eventId}`);
        return;
    }
    const subject = `Your Account Credentials - School ERP`;
    const html = `
    <h2>Hello ${name},</h2>
    <p>An account has been created for you.</p>
    <p>Your temporary password is: <b>${temporaryPassword}</b></p>
    <p>Please log in and change your password immediately.</p>
  `;
    try {
        await sendEmail(email, subject, html);
        await logRepo.markEventProcessed(eventId, email, 'EMAIL', 'SUCCESS');
        logger.info(`Credentials email sent to ${email}`);
    } catch (error: any) {
        await logRepo.markEventProcessed(eventId, email, 'EMAIL', 'FAILED', error.message);
        throw error;
    }
};
