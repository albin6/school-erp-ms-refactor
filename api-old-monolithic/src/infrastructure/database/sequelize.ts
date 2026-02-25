import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();
export const sequelize = new Sequelize(process.env.DATABASE_URL as string, {
    dialect: "postgres",
    logging: false,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false,
        },
    },
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
});
export const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log(" Database connected successfully.");
    } catch (error) {
        console.error(" Database connection failed:", error);
        process.exit(1);
    }
};
