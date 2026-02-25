import { z } from "zod";
export const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
});
export const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2),
    tenantName: z.string().optional(),
});
export const RefreshTokenSchema = z.object({
    refreshToken: z.string()
});
