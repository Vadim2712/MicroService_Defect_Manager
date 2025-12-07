require('./tracing');
const express = require('express');
const cors = require('cors');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const pino = require('pino')();
const pinoHttp = require('pino-http');
const { db: defaultDb } = require('./db/database');

const createApp = (db = defaultDb) => {
    const app = express();

    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(pinoHttp({ logger: pino }));

    // --- Схемы валидации ---
    const createOrderSchema = z.object({
      items: z.array(z.object({
        product: z.string().min(1),
        quantity: z.number().int().gte(1),
      })).min(1),
      totalAmount: z.number().positive(),
    });

    const updateOrderStatusSchema = z.object({
        status: z.enum(['created', 'in_progress', 'completed', 'cancelled']),
    });

    // --- Заглушка для событий домена ---
    const eventBroker = {
      publish: (eventName, data) => {
        pino.info({ eventName, data }, 'Событие домена опубликовано');
      }
    };

    // --- Middleware для псевдо-аутентификации ---
    const pseudoAuthMiddleware = (req, res, next) => {
      const userId = req.headers['x-user-id'];
      if (!userId) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Заголовок X-User-ID не предоставлен' } });
      }
      req.user = { id: userId };
      req.log = req.log.child({ userId: req.user.id });
      next();
    };

    // --- Маршруты ---

    // Создание заказа
    app.post('/', pseudoAuthMiddleware, async (req, res) => {
        req.log.info({ body: req.body }, 'Запрос на создание заказа');
        const validation = createOrderSchema.safeParse(req.body);
        if (!validation.success) {
            const errorMessage = validation.error.errors.map(e => e.message).join(', ');
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errorMessage } });
        }

        try {
            const { rows: users } = await db.query('SELECT id FROM users WHERE id = $1', [req.user.id]);
            if (users.length === 0) {
                return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Пользователь не найден' } });
            }

            const newOrder = {
                id: uuidv4(),
                userId: req.user.id,
                items: validation.data.items,
                status: 'created',
                totalAmount: validation.data.totalAmount,
            };

            const { rows } = await db.query(
                'INSERT INTO orders (id, "userId", items, status, "totalAmount") VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [newOrder.id, newOrder.userId, JSON.stringify(newOrder.items), newOrder.status, newOrder.totalAmount]
            );

            eventBroker.publish('order_created', { orderId: newOrder.id, userId: req.user.id });
            req.log.info({ orderId: newOrder.id }, 'Заказ создан');

            res.status(201).json({ success: true, data: rows[0] });
        } catch (error) {
            req.log.error(error, 'Ошибка при создании заказа');
            res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Внутренняя ошибка сервера' } });
        }
    });

    // Получение списка заказов текущего пользователя
    app.get('/', pseudoAuthMiddleware, async (req, res) => {
        req.log.info('Запрос на получение списка заказов');
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 10;
            const offset = (page - 1) * limit;
            const sortBy = req.query.sortBy || 'createdAt';
            const sortOrder = req.query.sortOrder || 'DESC';

            const { rows: orders } = await db.query(
                `SELECT * FROM orders WHERE "userId" = $1 ORDER BY "${sortBy}" ${sortOrder} LIMIT $2 OFFSET $3`,
                [req.user.id, limit, offset]
            );
            const { rows: totalRows } = await db.query('SELECT COUNT(*) FROM orders WHERE "userId" = $1', [req.user.id]);
            const total = parseInt(totalRows[0].count, 10);

            res.json({
                success: true,
                data: orders,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            req.log.error(error, 'Ошибка при получении списка заказов');
            res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Внутренняя ошибка сервера' } });
        }
    });

    // Получение заказа по ID
    app.get('/:id', pseudoAuthMiddleware, async (req, res) => {
        req.log.info({ orderId: req.params.id }, 'Запрос на получение заказа по ID');
        try {
            const { rows } = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
            const order = rows[0];

            if (!order) {
                return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Заказ не найден' } });
            }

            if (order.userId !== req.user.id) {
                return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Доступ к этому заказу запрещен' } });
            }

            res.json({ success: true, data: order });
        } catch (error) {
            req.log.error(error, 'Ошибка при получении заказа');
            res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Внутренняя ошибка сервера' } });
        }
    });

    // Обновление статуса заказа
    app.patch('/:id', pseudoAuthMiddleware, async (req, res) => {
        req.log.info({ orderId: req.params.id, body: req.body }, 'Запрос на обновление статуса заказа');
        const validation = updateOrderStatusSchema.safeParse(req.body);
        if (!validation.success) {
            const errorMessage = validation.error.errors.map(e => e.message).join(', ');
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errorMessage } });
        }

        try {
            const { rows } = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
            const order = rows[0];

            if (!order) {
                return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Заказ не найден' } });
            }

            if (order.userId !== req.user.id) {
                return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Вы не можете изменить этот заказ' } });
            }

            const { rows: updatedRows } = await db.query(
                'UPDATE orders SET status = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *',
                [validation.data.status, req.params.id]
            );

            eventBroker.publish('order_status_updated', { orderId: updatedRows[0].id, newStatus: validation.data.status });
            req.log.info({ orderId: updatedRows[0].id }, 'Статус заказа обновлен');

            res.json({ success: true, data: updatedRows[0] });
        } catch (error) {
            req.log.error(error, 'Ошибка при обновлении статуса заказа');
            res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Внутренняя ошибка сервера' } });
        }
    });

    // Отмена (удаление) заказа
    app.delete('/:id', pseudoAuthMiddleware, async (req, res) => {
        req.log.info({ orderId: req.params.id }, 'Запрос на отмену заказа');
        try {
            const { rows } = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
            const order = rows[0];

            if (!order) {
                return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Заказ не найден' } });
            }

            if (order.userId !== req.user.id) {
                return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Вы не можете отменить этот заказ' } });
            }

            const { rows: updatedRows } = await db.query(
                'UPDATE orders SET status = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *',
                ['cancelled', req.params.id]
            );

            eventBroker.publish('order_status_updated', { orderId: updatedRows[0].id, newStatus: 'cancelled' });
            req.log.info({ orderId: updatedRows[0].id }, 'Заказ отменен (статус изменен на cancelled)');

            res.json({ success: true, data: updatedRows[0] });
        } catch (error) {
            req.log.error(error, 'Ошибка при отмене заказа');
            res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Внутренняя ошибка сервера' } });
        }
    });

    // Health check
    app.get('/health', (req, res) => {
        res.json({ status: 'OK', service: 'Orders Service' });
    });

    return app;
};

if (require.main === module) {
  const PORT = process.env.PORT || 8002;
  const app = createApp();
  app.listen(PORT, () => {
    pino.info(`Orders service running on port ${PORT}`);
  });
}

module.exports = createApp;

