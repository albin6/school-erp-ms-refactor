import winston from 'winston';
import { config } from '../config';
const { combine, timestamp, json, errors, colorize, simple } = winston.format;
export const logger = winston.createLogger({
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    format: combine(
        errors({ stack: true }),
        timestamp(),
        json()
    ),
    defaultMeta: { service: 'tenant-service' },
    transports: [
        new winston.transports.Console({
            format: config.NODE_ENV === 'production'
                ? combine(errors({ stack: true }), timestamp(), json())
                : combine(colorize(), simple()),
        }),
    ],
});
