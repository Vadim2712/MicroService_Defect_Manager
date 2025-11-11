import express from 'express';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import pinoHttp from 'pino-http';
import logger from './utils/logger.js';
import { sendError } from './utils/response.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.use(pinoHttp({
    logger,
    genReqId: (req, res) => {
        const existingId = req.id || req.headers["x-request-id"];
        if (existingId) return existingId;
        const id = uuidv4();
        res.setHeader('X-Request-Id', id);
        return id;
    },
    customLogLevel: (req, res, err) => {
        if (res.statusCode >= 400 && res.statusCode < 500) return 'warn';
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 300 && res.statusCode < 400) return 'silent';
        return 'info';
    },
    customSuccessMessage: (req, res) => {
        if (res.statusCode < 400) {
            return `request completed ${req.method} ${req.url} ${res.statusCode}`;
        }
        return `request failed ${req.method} ${req.url} ${res.statusCode}`;
    }
}));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/admin', adminRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', service: 'service_users' });
});

app.use((req, res, next) => {
    sendError(res, 404, 'not_found', `Cannot ${req.method} ${req.path}`);
});

app.use((err, req, res, next) => {
    req.log.error({ err, stack: err.stack }, 'Unhandled error');
    sendError(res, 500, 'internal_error', 'Internal server error');
});

app.listen(PORT, () => {
    logger.info(`User service running on port ${PORT}`);
});