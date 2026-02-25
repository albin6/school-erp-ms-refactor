import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';
    logger.info(`Incoming Request: ${method} ${originalUrl} - IP: ${ip}`);
    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;
        const contentLength = res.get('content-length');
        const logMessage = `${method} ${originalUrl} ${statusCode} ${duration}ms - ${contentLength || 0}b - ${userAgent}`;
        if (statusCode >= 500) {
            logger.error(`Response: ${logMessage}`);
        } else if (statusCode >= 400) {
            logger.warn(`Response: ${logMessage}`);
        } else {
            logger.info(`Response: ${logMessage}`);
        }
    });
    next();
};
