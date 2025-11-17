import request from 'supertest';
import app from '../index.js';
import { pool } from '../db.js';
import jwt from 'jsonwebtoken';

// Mock the protect middleware to bypass the gateway
jest.mock('../middleware/auth.middleware.js', () => ({
    protect: (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            req.id = 'test-request-id';
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Invalid token' });
        }
    },
    authorize: (roles) => (req, res, next) => {
        if (roles.some(role => req.user.roles.includes(role))) {
            next();
        } else {
            res.status(403).json({ message: 'Forbidden' });
        }
    }
}));

describe('Order Routes', () => {
    let testUser, testAdmin, userToken, adminToken;

    beforeAll(async () => {
        // Clean up before starting
        await pool.query('DELETE FROM orders');
        await pool.query('DELETE FROM users');

        // Create users
        const userRes = await pool.query(
            `INSERT INTO users (email, password_hash, name, roles) 
             VALUES ('order-user@test.com', 'password', 'Order User', ARRAY['user']::VARCHAR[])
             RETURNING *`
        );
        testUser = userRes.rows[0];

        const adminRes = await pool.query(
            `INSERT INTO users (email, password_hash, name, roles) 
             VALUES ('order-admin@test.com', 'password', 'Order Admin', ARRAY['user', 'admin']::VARCHAR[])
             RETURNING *`
        );
        testAdmin = adminRes.rows[0];

        // Generate tokens
        userToken = jwt.sign({ id: testUser.id, roles: testUser.roles }, process.env.JWT_SECRET);
        adminToken = jwt.sign({ id: testAdmin.id, roles: testAdmin.roles }, process.env.JWT_SECRET);
    });

    afterAll(async () => {
        await pool.query('DELETE FROM orders');
        await pool.query('DELETE FROM users');
        await pool.end();
    });


    describe('POST /api/v1/orders', () => {
        it('should create an order successfully for an authenticated user', async () => {
            const res = await request(app)
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    items: [{ product: 'Test Product', quantity: 2 }],
                    total_sum: 99.99
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.data).toHaveProperty('id');
            expect(res.body.data.user_id).toBe(testUser.id);
            expect(res.body.data.total_sum).toBe('99.99');
        });

        it('should return 401 Unauthorized if no token is provided', async () => {
            const res = await request(app)
                .post('/api/v1/orders')
                .send({
                    items: [{ product: 'Test Product', quantity: 2 }],
                    total_sum: 99.99
                });

            expect(res.statusCode).toBe(401);
        });

        it('should return 400 Bad Request for invalid order data', async () => {
            const res = await request(app)
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    items: [], // Invalid: must have at least one item
                    total_sum: -10
                });
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error.code).toBe('validation_error');
        });
    });

    describe('GET /api/v1/orders/:id', () => {
        let orderId;

        beforeAll(async () => {
            const res = await pool.query(
                `INSERT INTO orders (user_id, items, total_sum, status)
                 VALUES ($1, $2, $3, 'created')
                 RETURNING id`,
                [testUser.id, JSON.stringify([{ product: 'Belongs to User', quantity: 1 }]), 10.00]
            );
            orderId = res.rows[0].id;
        });

        it('should return the order if requested by the owner', async () => {
            const res = await request(app)
                .get(`/api/v1/orders/${orderId}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.id).toBe(orderId);
        });

        it('should return the order if requested by an admin', async () => {
            const res = await request(app)
                .get(`/api/v1/orders/${orderId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.id).toBe(orderId);
        });

        it('should return 403 Forbidden if requested by another user who is not an admin', async () => {
            // Create a different user
            const otherUserRes = await pool.query(
                `INSERT INTO users (email, password_hash, name, roles) 
                 VALUES ('other-user@test.com', 'password', 'Other User', ARRAY['user']::VARCHAR[])
                 RETURNING *`
            );
            const otherUser = otherUserRes.rows[0];
            const otherUserToken = jwt.sign({ id: otherUser.id, roles: otherUser.roles }, process.env.JWT_SECRET);

            const res = await request(app)
                .get(`/api/v1/orders/${orderId}`)
                .set('Authorization', `Bearer ${otherUserToken}`);

            expect(res.statusCode).toBe(403);
        });

        it('should return 404 Not Found for a non-existent order', async () => {
            const nonExistentId = '00000000-0000-0000-0000-000000000000';
            const res = await request(app)
                .get(`/api/v1/orders/${nonExistentId}`)
                .set('Authorization', `Bearer ${userToken}`);
            
            expect(res.statusCode).toBe(404);
        });
    });
});
