import { Request, Response, NextFunction } from 'express';
import { loginUseCase } from '../../../application/use-cases/login.usecase';
import { AppError } from '../../../domain/errors/AppError';
import { z } from 'zod';
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
export const loginController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const body = loginSchema.parse(req.body);
        const ip = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? 'unknown';
        const userAgent = req.headers['user-agent'] ?? 'unknown';
        const correlationId = req.headers['x-correlation-id'] as string;
        const result = await loginUseCase({
            email: body.email,
            password: body.password,
            ip,
            userAgent,
            correlationId,
        });
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: result.userId,
                    email: result.email,
                    name: result.name,
                    isSuperAdmin: result.isSuperAdmin,
                    mustResetPassword: result.mustResetPassword,
                },
                accessToken: result.accessToken,
            },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(error.errors[0].message, 400));
            return;
        }
        next(error);
    }
};
