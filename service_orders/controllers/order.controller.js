import { createOrder, findOrderById, findOrdersByUserId, updateOrderStatus } from '../models/order.model.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

export const createNewOrder = async (req, res) => {
    const userId = req.user.id;
    const { items, total_sum } = req.body;
    const requestId = req.id;

    logger.info({ requestId, userId, items }, 'Create order attempt');

    try {
        const newOrder = await createOrder(userId, items, total_sum);
        logger.info({ requestId, orderId: newOrder.id }, 'Order created successfully');
        sendSuccess(res, 201, newOrder);
    } catch (error) {
        logger.error({ requestId, error: error.message }, 'Create order controller error');
        sendError(res, 500, 'internal_error', 'Internal server error');
    }
};

export const getOrderById = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const requestId = req.id;

    logger.info({ requestId, userId, orderId: id }, 'Get order by ID attempt');

    try {
        const order = await findOrderById(id);
        if (!order) {
            logger.warn({ requestId, orderId: id }, 'Get order failed: Not found');
            return sendError(res, 404, 'not_found', 'Order not found');
        }

        if (order.user_id !== userId && !req.user.roles.includes('admin')) {
            logger.warn({ requestId, userId, orderId: id, ownerId: order.user_id }, 'Get order failed: Forbidden');
            return sendError(res, 403, 'forbidden', 'Access denied');
        }

        logger.info({ requestId, orderId: id }, 'Get order successful');
        sendSuccess(res, 200, order);
    } catch (error) {
        logger.error({ requestId, error: error.message }, 'Get order by ID controller error');
        sendError(res, 500, 'internal_error', 'Internal server error');
    }
};

export const listMyOrders = async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 10, sort_by = 'created_at', sort_order = 'desc' } = req.query;
    const offset = (page - 1) * limit;
    const requestId = req.id;

    logger.info({ requestId, userId, page, limit }, 'List my orders attempt');

    try {
        const { orders, total } = await findOrdersByUserId(userId, limit, offset, sort_by, sort_order);

        const totalPages = Math.ceil(total / limit);

        logger.info({ requestId, userId, count: orders.length, total }, 'List my orders successful');
        sendSuccess(res, 200, {
            orders,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages,
            },
        });
    } catch (error) {
        logger.error({ requestId, error: error.message }, 'List my orders controller error');
        sendError(res, 500, 'internal_error', 'Internal server error');
    }
};

export const updateStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const requestId = req.id;
    const userId = req.user.id;

    logger.info({ requestId, orderId: id, newStatus: status }, 'Update order status attempt');

    try {
        const order = await findOrderById(id);
        if (!order) {
            logger.warn({ requestId, orderId: id }, 'Update status failed: Not found');
            return sendError(res, 404, 'not_found', 'Order not found');
        }

        if (status === 'cancelled' && order.user_id !== userId) {
            logger.warn({ requestId, userId, orderId: id, ownerId: order.user_id }, 'Update status (cancel) failed: Forbidden');
            return sendError(res, 403, 'forbidden', 'Only the owner can cancel this order');
        }

        const updatedOrder = await updateOrderStatus(id, status);
        logger.info({ requestId, orderId: id }, 'Update status successful');
        sendSuccess(res, 200, updatedOrder);
    } catch (error) {
        logger.error({ requestId, error: error.message }, 'Update status controller error');
        sendError(res, 500, 'internal_error', 'Internal server error');
    }
};