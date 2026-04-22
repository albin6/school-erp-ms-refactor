import 'dotenv/config';
import { z } from 'zod';
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(8000),
    REDIS_URL: z.string().url(),
    IDENTITY_SERVICE_URL: z.string().url(),
    TENANT_SERVICE_URL: z.string().url(),
    IDENTITY_GRPC_HOST: z.string().min(1),
    TENANT_GRPC_HOST: z.string().min(1),
    CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://sub1.localhost:5173'),
    TENANT_CACHE_TTL_SECONDS: z.coerce.number().default(30),
    INTERNAL_AUTH_SECRET: z.string().optional(),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error(' Invalid API Gateway environment configuration:');
    console.error(parsed.error.format());
    process.exit(1);
}
export const config = parsed.data;
