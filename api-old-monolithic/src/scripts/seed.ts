import { User, initModels } from "../infrastructure/database/models";
import { hashPassword } from "../core/security/password.service";
import { sequelize } from "../infrastructure/database/sequelize";
import dotenv from 'dotenv';
dotenv.config();
const seed = async () => {
    try {
        await sequelize.authenticate();
        await initModels();
        const email = process.env.SUPER_ADMIN_EMAIL || "admin@school.com";
        const password = process.env.SUPER_ADMIN_PASSWORD;

        if (!password) {
            throw new Error("SUPER_ADMIN_PASSWORD is not defined in environment variables.");
        }
        const existing = await User.findOne({ where: { email } });
        if (existing) {
            console.log(" Super Admin already exists.");
            return;
        }
        const password_hash = await hashPassword(password);
        await User.create({
            email,
            password_hash,
            name: "Super Admin",
            is_super_admin: true,
            is_active: true
        });
        console.log(` Super Admin checked/created: ${email}`);
    } catch (err) {
        console.error(" Seed failed:", err);
    } finally {
        await sequelize.close();
    }
};
seed();
