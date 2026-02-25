import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { HealthModule } from "./modules/health";
import AuthRoutes from "./modules/auth/routes/auth.routes";
import TenantAuthRoutes from "./modules/auth/routes/tenant-auth.routes";
import PasswordResetOTPRoutes from "./modules/auth/routes/password-reset-otp.routes";
import { tenantRoutes } from "./modules/tenant";
import { errorHandler } from "./core/middleware/error.middleware";
import { requestLogger } from "./core/middleware/request-logger.middleware";
const app = express();
app.use(helmet());
app.use(requestLogger);
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const rootDomain = process.env.ROOT_DOMAIN;
        const escapedRootDomain = rootDomain?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const originPattern = escapedRootDomain
            ? new RegExp(`^https?:\\/\\/([a-z0-9-]+\\.)?${escapedRootDomain}$`)
            : null;
        const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
        if ((originPattern && originPattern.test(origin)) || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    exposedHeaders: ['set-cookie']
}));
app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
    })
);
app.use(express.json());
app.use(cookieParser());
app.use("/health", HealthModule.routes);
app.use("/auth", AuthRoutes);
app.use("/auth", TenantAuthRoutes);
app.use("/auth", PasswordResetOTPRoutes);
app.use("/api/tenants", tenantRoutes);
app.use(errorHandler);
export default app;
