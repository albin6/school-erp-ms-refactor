import 'dotenv/config';
import { z } from 'zod';
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    HTTP_PORT: z.coerce.number().default(3003),
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().default(5432),
    DB_NAME: z.string().min(1),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
    KAFKA_BROKERS: z.string().min(1),
    KAFKA_CLIENT_ID: z.string().default('notification-service'),
    KAFKA_GROUP_ID: z.string().default('notification-service-group'),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.string().default('noreply@school-erp.com'),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error(' Invalid Notification Service environment configuration:');
    console.error(parsed.error.format());
    process.exit(1);
}
export const config = parsed.data;
