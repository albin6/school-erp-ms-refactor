import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { logger } from '../../config/logger';
import { getKafkaReadiness } from '../../infrastructure/messaging/kafka.readiness';
const startedAt = Date.now();
const renderMetrics = () => {
    const memory = process.memoryUsage();
    const kafka = getKafkaReadiness();
    return [
        '# HELP service_info Static service metadata',
        '# TYPE service_info gauge',
        'service_info{service="audit-service"} 1',
        '# HELP process_uptime_seconds Service process uptime in seconds',
        '# TYPE process_uptime_seconds gauge',
        `process_uptime_seconds ${Math.floor((Date.now() - startedAt) / 1000)}`,
        '# HELP process_resident_memory_bytes Resident memory size in bytes',
        '# TYPE process_resident_memory_bytes gauge',
        `process_resident_memory_bytes ${memory.rss}`,
        '# HELP kafka_ready Kafka consumer readiness status',
        '# TYPE kafka_ready gauge',
        `kafka_ready ${kafka.ready ? 1 : 0}`,
        '',
    ].join('\n');
};
export const createHttpServer = () => {
    const app = express();
    app.use(helmet());
    app.use(express.json());
    app.use(cors());
    app.get('/health/live', (_req, res) => res.status(200).send('OK'));
    app.get('/health/ready', async (_req, res) => {
        const kafka = getKafkaReadiness();
        if (!kafka.ready) {
            return res.status(503).send('NOT_READY');
        }
        return res.status(200).send('READY');
    });
    app.get('/metrics', (_req, res) => {
        res.set('Content-Type', 'text/plain; version=0.0.4');
        res.send(renderMetrics());
    });
    app.use((req, res) => {
        logger.warn(`Route not found on audit service HTTP interface: ${req.path}`);
        res.status(404).json({ success: false, error: 'Route not found' });
    });
    return app;
};
