import 'dotenv/config';
import { z } from 'zod';
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    HTTP_PORT: z.coerce.number().default(3000),
    GRPC_PORT: z.coerce.number().default(5000),
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().default(5432),
    DB_NAME: z.string().min(1),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
    DB_POOL_MAX: z.coerce.number().default(10),
    REDIS_URL: z.string().url(),
    KAFKA_BROKERS: z.string().min(1),
    KAFKA_CLIENT_ID: z.string().default('identity-service'),
    KAFKA_GROUP_ID: z.string().default('identity-service-group'),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    SMTP_HOST: z.string().default('smtp.gmail.com'),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.string().default('noreply@school-erp.com'),
    CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
    ROOT_DOMAIN: z.string().default('localhost:5173'),
    PROTOCOL: z.string().default('http'),
    SUPER_ADMIN_EMAIL: z.string().email().optional(),
    SUPER_ADMIN_PASSWORD: z.string().min(8).optional(),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error(' Invalid environment configuration:');
    console.error(parsed.error.format());
    process.exit(1);
}
export const config = parsed.data;
export type Config = typeof config;
