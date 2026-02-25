import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { tenantRoutes } from './routes/tenant.routes';
import { AppError } from '../../domain/errors/AppError';
export const createHttpServer = () => {
    const app = express();
    app.use(helmet());
    app.use(cookieParser());
    app.use(express.json());
    app.use(
        cors({
            origin: config.CORS_ALLOWED_ORIGINS.split(','),
            credentials: true,
        })
    );
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
    });
    app.use('/api/', limiter);
    app.use((req, _res, next) => {
        const correlationId = req.headers['x-correlation-id'] || 'unknown';
        logger.debug(`${req.method} ${req.path}`, { correlationId });
        next();
    });
    app.get('/health/live', (_req, res) => res.status(200).send('OK'));
    app.get('/health/ready', async (_req, res) => res.status(200).send('READY'));
    app.get('/metrics', (_req, res) => {
        res.set('Content-Type', 'text/plain');
        res.send('# HELP placeholder_metric A placeholder metric\n# TYPE placeholder_metric gauge\nplaceholder_metric 1');
    });
    app.use('/api/tenants', tenantRoutes);
    app.use((req, res) => {
        res.status(404).json({ success: false, error: 'Route not found' });
    });
    app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
        if (err instanceof AppError) {
            res.status(err.statusCode).json({ success: false, error: err.message });
            return;
        }
        logger.error('Unhandled app error', { stack: err.stack, path: req.path });
        res.status(500).json({ success: false, error: 'Internal server error' });
    });
    return app;
};
