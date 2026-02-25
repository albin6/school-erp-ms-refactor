import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../domain/errors/AppError';
import { logger } from '../../../config/logger';
export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    const correlationId = req.headers['x-correlation-id'] as string;
    if (err instanceof AppError) {
        logger.warn('Operational error', {
            message: err.message,
            statusCode: err.statusCode,
            correlationId,
            path: req.path,
        });
        res.status(err.statusCode).json({
            success: false,
            error: err.message,
            correlationId,
        });
        return;
    }
    logger.error('Unhandled error', {
        message: err.message,
        stack: err.stack,
        correlationId,
        path: req.path,
    });
    res.status(500).json({
        success: false,
        error: 'An internal server error occurred',
        correlationId,
    });
};
export const notFoundHandler = (req: Request, res: Response): void => {
    res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
};
