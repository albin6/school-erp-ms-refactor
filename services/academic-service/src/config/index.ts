import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    HTTP_PORT: z.coerce.number().default(3005),
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().default(5432),
    DB_NAME: z.string().min(1),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
    DB_POOL_MAX: z.coerce.number().default(10),
    KAFKA_BROKERS: z.string().min(1),
    KAFKA_CLIENT_ID: z.string().default('academic-service'),
    KAFKA_GROUP_ID: z.string().default('academic-service-group'),
    TENANT_GRPC_HOST: z.string().min(1),
    CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
    INTERNAL_AUTH_SIGNING_SECRET: z.string().trim().min(32),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error(' Invalid Academic Service environment configuration:');
    console.error(parsed.error.format());
    process.exit(1);
}

export const config = parsed.data;
