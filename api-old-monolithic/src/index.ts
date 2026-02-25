import dotenv from "dotenv";
dotenv.config();
import app from "./server";
import { connectDB } from "./infrastructure/database/sequelize";
import { initModels } from "./infrastructure/database/models";
import { connectRedis } from "./infrastructure/redis/redis.client";
import { seedSuperAdmin } from "./core/utils/seed-super-admin";
const PORT = process.env.PORT || 3000;
(async () => {
    try {
        console.log(" Starting server...");
        await connectDB();
        await initModels();
        await seedSuperAdmin();
        await connectRedis();
        app.listen(PORT, () => {
            console.log(` Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error(" Failed to start server:", error);
        process.exit(1);
    }
})();
