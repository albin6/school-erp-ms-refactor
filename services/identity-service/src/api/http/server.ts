import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { config } from '../../config';
import { authRoutes } from './routes/auth.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { logger } from '../../config/logger';
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
        message: { success: false, error: 'Too many requests, please try again later.' },
    });
    app.use('/api/', limiter);
    app.use((req, _res, next) => {
        const correlationId = req.headers['x-correlation-id'] || 'unknown';
        logger.debug(`${req.method} ${req.path}`, { correlationId });
        next();
    });
    app.get('/health/live', (_req, res) => res.status(200).send('OK'));
    app.get('/health/ready', async (_req, res) => {
        res.status(200).send('READY');
    });
    app.get('/metrics', (_req, res) => {
        res.set('Content-Type', 'text/plain');
        res.send('# HELP placeholder_metric A placeholder metric\n# TYPE placeholder_metric gauge\nplaceholder_metric 1');
    });
    app.use('/api/auth', authRoutes);
    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
};
