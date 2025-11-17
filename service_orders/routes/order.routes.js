import express from 'express';
import { createNewOrder, getOrderById, listMyOrders, updateStatus, cancelOrder } from '../controllers/order.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createOrderSchema, updateStatusSchema } from '../validations/order.validation.js';

const router = express.Router();

router.use(protect);

router.post('/', validate(createOrderSchema), createNewOrder);
router.get('/', listMyOrders);
router.get('/:id', getOrderById);

router.patch(
    '/:id/status',
    validate(updateStatusSchema),
    authorize(['admin']),
    updateStatus
);

router.patch(
    '/:id/cancel',
    cancelOrder
);

export default router;