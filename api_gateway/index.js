require('./tracing');
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const pino = require('pino')();
const pinoHttp = require('pino-http');
const { v4: uuidv4 } = require('uuid');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key'; // Должен совпадать с service_users

// --- Swagger ---
const swaggerDocument = YAML.load(path.join(__dirname, './docs/openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));


// --- Middleware ---
app.use(cors());

// Логирование с X-Request-ID
app.use((req, res, next) => {
    // Игнорируем логи для Swagger
    if (req.originalUrl.startsWith('/api-docs')) {
        return next();
    }
    req.id = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-ID', req.id);
    next();
});
app.use(pinoHttp({
    logger: pino,
    genReqId: (req) => req.id,
    customProps: (req) => ({
        // Дополнительные свойства для логов
        'x-request-id': req.id,
    }),
    // Игнорируем логи для Swagger
    autoLogging: {
        ignore: (req) => req.originalUrl.startsWith('/api-docs'),
    },
}));

// Ограничение частоты запросов
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100, // Максимум 100 запросов с одного IP
    message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Слишком много запросов с вашего IP, попробуйте позже.' } },
    standardHeaders: true, // Возвращает информацию о лимите в заголовках RateLimit-*
    legacyHeaders: false, // Отключает заголовки X-RateLimit-*
});
app.use(limiter);

// --- JWT Аутентификация Middleware ---
const jwtAuthMiddleware = (req, res, next) => {
    // Маршруты, не требующие аутентификации
    const excludedPaths = ['/v1/users/register', '/v1/users/login', '/health'];
    if (excludedPaths.includes(req.originalUrl) || req.originalUrl.startsWith('/api-docs')) {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.log.warn('JWT: Токен не предоставлен');
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Токен не предоставлен' } });
    }

    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload; // payload содержит id и roles пользователя

        // Прокидываем информацию о пользователе в нижестоящие сервисы
        req.headers['x-user-id'] = payload.id;
        req.headers['x-user-roles'] = JSON.stringify(payload.roles); // Роли как строка JSON
        req.log.info({ userId: payload.id }, 'JWT: Токен успешно верифицирован');
        next();
    } catch (error) {
        req.log.warn({ error: error.message }, 'JWT: Невалидный токен');
        return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Невалидный токен' } });
    }
};
app.use('/v1', jwtAuthMiddleware); // Применяем middleware ко всем маршрутам /v1, кроме исключений

// --- Проксирование сервисов ---
const USERS_SERVICE_URL = process.env.USERS_SERVICE_URL || 'http://localhost:8001'; // Порт service_users
const ORDERS_SERVICE_URL = process.env.ORDERS_SERVICE_URL || 'http://localhost:8002'; // Порт service_orders

app.use('/v1/users', createProxyMiddleware({
    target: USERS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/v1/users': '/', // Убираем префикс, чтобы сервис получал /register, /login и т.д.
    },
    onProxyReq: (proxyReq, req) => {
        proxyReq.setHeader('X-Request-ID', req.id);
        if (req.user) { // Передаем данные пользователя, если он аутентифицирован
            proxyReq.setHeader('X-User-ID', req.user.id);
            proxyReq.setHeader('X-User-Roles', JSON.stringify(req.user.roles));
        }
        req.log.info(`Проксирование запроса к users-service: ${req.method} ${req.originalUrl}`);
    },
    onError: (err, req, res) => {
        req.log.error({ err }, 'Ошибка проксирования к users-service');
        res.status(500).json({ success: false, error: { code: 'PROXY_ERROR', message: 'Ошибка при обращении к сервису пользователей' } });
    }
}));

app.use('/v1/orders', createProxyMiddleware({
    target: ORDERS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/v1/orders': '/', // Аналогично для сервиса заказов
    },
    onProxyReq: (proxyReq, req) => {
        proxyReq.setHeader('X-Request-ID', req.id);
        if (req.user) { // Передаем данные пользователя, если он аутентифицирован
            proxyReq.setHeader('X-User-ID', req.user.id);
            proxyReq.setHeader('X-User-Roles', JSON.stringify(req.user.roles));
        }
        req.log.info(`Проксирование запроса к orders-service: ${req.method} ${req.originalUrl}`);
    },
    onError: (err, req, res) => {
        req.log.error({ err }, 'Ошибка проксирования к orders-service');
        res.status(500).json({ success: false, error: { code: 'PROXY_ERROR', message: 'Ошибка при обращении к сервису заказов' } });
    }
}));


// Health check
app.get('/health', (req, res) => {
    req.log.info('Health check');
    res.json({ status: 'OK', service: 'API Gateway' });
});

// Обработка ошибок (если дошли до сюда, значит маршрут не найден)
app.use((req, res) => {
    req.log.warn(`Неизвестный маршрут: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Маршрут не найден' } });
});

// Запуск сервера
app.listen(PORT, () => {
  pino.info(`API Gateway запущен на порту ${PORT}`);
  pino.info(`Swagger UI доступен по адресу http://localhost:${PORT}/api-docs`);
});
