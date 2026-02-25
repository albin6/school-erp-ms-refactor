import { User } from "../../infrastructure/database/models";
import * as PasswordService from "../security/password.service";
import { logger } from "./logger";
export const seedSuperAdmin = async () => {
    try {
        const email = process.env.SUPER_ADMIN_EMAIL;
        const password = process.env.SUPER_ADMIN_PASSWORD;
        if (!email || !password) {
            logger.warn("️ SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set. Skipping Super Admin seeding.");
            return;
        }
        const existingAdmin = await User.findOne({ where: { email } });
        if (existingAdmin) {
            if (!existingAdmin.is_super_admin) {
                logger.info("ℹ️ User found but not Super Admin. Promoting to Super Admin.");
                existingAdmin.is_super_admin = true;
                await existingAdmin.save();
            }
        } else {
            logger.info("ℹ️ Super Admin not found. Creating new Super Admin...");
            const passwordHash = await PasswordService.hashPassword(password);
            await User.create({
                email,
                password_hash: passwordHash,
                name: "Super Admin",
                is_super_admin: true,
                is_active: true,
                must_reset_password: false
            });
            logger.info(" Super Admin created successfully.");
        }
    } catch (error) {
        logger.error(` Failed to seed Super Admin: ${error}`);
    }
};
