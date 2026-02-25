import { z } from 'zod';
export const CreateTenantSchema = z.object({
    name: z.string().min(3, 'Name must be at least 3 characters'),
    subdomain: z.string()
        .min(3, 'Subdomain must be at least 3 characters')
        .max(63, 'Subdomain must be less than 63 characters')
        .regex(/^[a-z0-9-]+$/, 'Subdomain must contain only lowercase letters, numbers, and hyphens')
        .refine(
            val => !['www', 'api', 'admin', 'sadmin', 'app'].includes(val),
            { message: 'This subdomain is reserved' }
        ),
    admin_email: z.string().email('Invalid email address'),
    domain: z.string().optional(),
    settings: z.record(z.string(), z.any()).optional(),
});
export const UpdateTenantSchema = z.object({
    name: z.string().min(3).optional(),
    domain: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
    settings: z.record(z.string(), z.any()).optional(),
    is_active: z.boolean().optional(),
});
export const TenantQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
    search: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
    sortBy: z.enum(['name', 'created_at', 'subdomain']).default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type CreateTenantDTO = z.infer<typeof CreateTenantSchema>;
export type UpdateTenantDTO = z.infer<typeof UpdateTenantSchema>;
export type TenantQueryDTO = z.infer<typeof TenantQuerySchema>;
