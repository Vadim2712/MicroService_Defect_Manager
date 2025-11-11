import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';

import logger from './utils/logger.js';
import { sendError } from './utils/response.js';
import { protect } from './middleware/auth.middleware.js';
import { usersProxy, ordersProxy } from './middleware/proxy.handler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID']
}));

app.use(express.json());

app.use(pinoHttp({
    logger,
    genReqId: (req, res) => {
        const existingId = req.headers["x-request-id"];
        if (existingId) return existingId;
        const id = uuidv4();
        res.setHeader('X-Request-ID', id);
        return id;
    },
    customLogLevel: (req, res, err) => {
        if (res.statusCode >= 400 && res.statusCode < 500) return 'warn';
        if (res.statusCode >= 500 || err) return 'error';
        return 'info';
    },
    customSuccessMessage: (req, res) => `request ${req.id} completed`,
    customErrorMessage: (req, res, err) => `request ${req.id} failed`
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        logger.warn({ requestId: req.id, ip: req.ip }, 'Rate limit exceeded');
        sendError(res, options.statusCode, 'rate_limit', options.message);
    }
});

app.use(limiter);

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'API Gateway is running' });
});

app.use('/api/v1/auth', usersProxy);
app.use('/api/v1/users', protect, usersProxy);
app.use('/api/v1/admin', protect, usersProxy);
app.use('/api/v1/orders', protect, ordersProxy);

app.use((req, res, next) => {
    sendError(res, 404, 'not_found', `Cannot ${req.method} ${req.path} on Gateway`);
});

app.use((err, req, res, next) => {
    req.log.error({ err, stack: err.stack }, 'Unhandled Gateway error');
    sendError(res, 500, 'internal_error', 'Internal server error');
});

app.listen(PORT, () => {
    logger.info(`API Gateway running on port ${PORT}`);
});