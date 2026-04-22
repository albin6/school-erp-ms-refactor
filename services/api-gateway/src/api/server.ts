import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { rateLimit } from 'express-rate-limit';
import http from 'http';
import https from 'https';
import { config } from '../config';
import { logger } from '../config/logger';
import { gatewayMiddleware } from './middleware';
export const createHttpServer = () => {
    const app = express();
    app.use(helmet());
    app.use(express.json()); // Add JSON body parser
    app.use(
        cors({
            origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
                const allowedOrigins = config.CORS_ALLOWED_ORIGINS.split(',');
                if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.localhost:5173')) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            credentials: true,
        })
    );
    const limiter = rateLimit({
        windowMs: 60 * 1000,
        max: 1000,
        message: { success: false, error: 'Gateway Rate limit exceeded.' },
    });
    app.use(limiter);
    
    // Request logging middleware
    app.use((req, res, next) => {
        logger.info(`Gateway received: ${req.method} ${req.path}`, { service: 'api-gateway' });
        next();
    });
    
    app.use(gatewayMiddleware);
    app.get('/health/live', (_req, res) => res.status(200).send('OK'));
    app.get('/health/ready', (_req, res) => res.status(200).send('READY'));
    app.get('/metrics', (_req, res) => {
        res.set('Content-Type', 'text/plain');
        res.send('# HELP placeholder_metric A placeholder metric\n# TYPE placeholder_metric gauge\nplaceholder_metric 1');
    });
    const routes = {
        '/api/auth': config.IDENTITY_SERVICE_URL,
        '/api/users': config.IDENTITY_SERVICE_URL,
        '/api/tenants': config.TENANT_SERVICE_URL,
        '/api/branches': config.TENANT_SERVICE_URL,
        '/api/memberships': config.TENANT_SERVICE_URL,
    };

    // Create HTTP agents with timeout settings
    const httpAgent = new http.Agent({
        timeout: 10000,
        keepAlive: true,
    });
    const httpsAgent = new https.Agent({
        timeout: 10000,
        keepAlive: true,
    });

    Object.entries(routes).forEach(([path, target]) => {
        const isHttps = target.startsWith('https');
        app.use(
            createProxyMiddleware({
                target,
                changeOrigin: true,
                pathFilter: path,
                pathRewrite: (path: string) => path,
                timeout: 30000,
                proxyTimeout: 30000,
                agent: isHttps ? httpsAgent : httpAgent,
                on: {
                    error: (err: Error, req: any, res: any) => {
                        logger.error(`Proxy Error for ${path}:`, err);
                        res.writeHead(502, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Downstream service unavailable' }));
                    }
                },
                logger: logger,
            })
        );
    });
    app.use((req, res) => {
        res.status(404).json({ success: false, error: 'API Gateway Route not found' });
    });
    return app;
};
