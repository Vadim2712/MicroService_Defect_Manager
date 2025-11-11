import { createProxyMiddleware } from 'http-proxy-middleware';
import logger from '../utils/logger.js';

const USERS_SERVICE_URL = process.env.USERS_SERVICE_URL;
const ORDERS_SERVICE_URL = process.env.ORDERS_SERVICE_URL;

const onProxyReq = (proxyReq, req, res) => {
    proxyReq.setHeader('X-Request-ID', req.id);

    if (req.user) {
        proxyReq.setHeader('X-User-ID', req.user.id);
        proxyReq.setHeader('X-User-Roles', req.user.roles.join(','));
    }

    if (req.body) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
    }
};

const onError = (err, req, res) => {
    logger.error({
        requestId: req.id,
        error: err.message,
        target: err.config?.target
    }, 'Proxy error');

    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        success: false,
        error: {
            code: 'service_unavailable',
            message: 'The requested service is temporarily unavailable.'
        }
    }));
};

const baseProxyOptions = {
    changeOrigin: true,
    logProvider: () => logger,
    logLevel: 'debug',
    onProxyReq,
    onError,
};

export const usersProxy = createProxyMiddleware({
    ...baseProxyOptions,
    target: USERS_SERVICE_URL,
    pathRewrite: (path, req) => {
        return path.replace('/api/v1', '/api/v1');
    }
});

export const ordersProxy = createProxyMiddleware({
    ...baseProxyOptions,
    target: ORDERS_SERVICE_URL,
    pathRewrite: (path, req) => {
        return path.replace('/api/v1/orders', '/api/v1/orders');
    }
});