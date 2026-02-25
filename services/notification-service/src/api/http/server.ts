import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { logger } from '../../config/logger';
export const createHttpServer = () => {
    const app = express();
    app.use(helmet());
    app.use(express.json());
    app.use(cors());
    app.get('/health/live', (_req, res) => res.status(200).send('OK'));
    app.get('/health/ready', async (_req, res) => res.status(200).send('READY'));
    app.get('/metrics', (_req, res) => {
        res.set('Content-Type', 'text/plain');
        res.send('# HELP placeholder_metric A placeholder metric\n# TYPE placeholder_metric gauge\nplaceholder_metric 1');
    });
    app.use((req, res) => {
        logger.warn(`Route not found on internal notification service HTTP interface: ${req.path}`);
        res.status(404).json({ success: false, error: 'Route not found' });
    });
    return app;
};
