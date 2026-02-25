import { z } from 'zod';
export const TenantLoginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
});
export type TenantLoginDTO = z.infer<typeof TenantLoginSchema>;
