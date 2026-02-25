import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
interface RateLimitOptions {
    windowMs: number;
    max: number;
    message?: string;
    keyGenerator?: (req: Request) => string;
}
export const rateLimit = (options: RateLimitOptions) => {
    const {
        windowMs,
        max,
        message = 'Too many requests, please try again later',
        keyGenerator = (req) => req.ip || 'unknown'
    } = options;
    return (req: Request, res: Response, next: NextFunction) => {
        const key = keyGenerator(req);
        const now = Date.now();
        let record = rateLimitStore.get(key);
        if (!record || now > record.resetTime) {
            record = {
                count: 0,
                resetTime: now + windowMs
            };
        }
        record.count++;
        rateLimitStore.set(key, record);
        if (record.count > max) {
            const retryAfter = Math.ceil((record.resetTime - now) / 1000);
            res.setHeader('Retry-After', retryAfter.toString());
            throw new AppError(message, 429);
        }
        res.setHeader('X-RateLimit-Limit', max.toString());
        res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count).toString());
        res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());
        next();
    };
};
export const cleanupRateLimitStore = () => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
        if (now > record.resetTime) {
            rateLimitStore.delete(key);
        }
    }
};
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
