import { z } from 'zod';

const orderItemSchema = z.object({
    product: z.string().min(1, 'Product name is required'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

export const createOrderSchema = z.object({
    items: z.array(orderItemSchema).min(1, 'Order must contain at least one item'),
    total_sum: z.number().min(0, 'Total sum must be a positive number'),
});

export const updateStatusSchema = z.object({
    status: z.enum(['in_progress', 'completed', 'cancelled']),
});