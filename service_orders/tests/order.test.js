import request from 'supertest';
import app from '../index.js';
import { pool } from '../db.js';
import jwt from 'jsonwebtoken';

// Use a consistent, test-only secret
const TEST_JWT_SECRET = 'a-very-secret-test-key-for-orders';
process.env.JWT_SECRET = TEST_JWT_SECRET;

describe('Order Routes', () => {
    let testUser, testAdmin, userToken, adminToken;
    
    // beforeEach: Clean database and set up fresh users for every test
    beforeEach(async () => {
        await pool.query('DELETE FROM orders');
        await pool.query('DELETE FROM users');

        // Create a standard user
        const userRes = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, roles) 
             VALUES ('order-user@test.com', 'password', 'Order User', ARRAY['user']::VARCHAR[])
             RETURNING *`
        );
        testUser = userRes.rows[0];

        // Create an admin user
        const adminRes = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, roles) 
             VALUES ('order-admin@test.com', 'password', 'Order Admin', ARRAY['user', 'admin']::VARCHAR[])
             RETURNING *`
        );
        testAdmin = adminRes.rows[0];

        // Generate tokens for them
        userToken = jwt.sign({ id: testUser.id, roles: testUser.roles }, process.env.JWT_SECRET);
        adminToken = jwt.sign({ id: testAdmin.id, roles: testAdmin.roles }, process.env.JWT_SECRET);
    });

    // afterAll: Clean up and close the connection
    afterAll(async () => {
        await pool.end();
    });


    describe('POST /api/v1/orders', () => {
        it('should create an order successfully for an authenticated user', async () => {
            const res = await request(app)
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    items: [{ product: 'Test Product', quantity: 2 }],
                    total_sum: 99.99,
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
                    total_sum: 99.99,
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
        
        it('should return the order if requested by the owner', async () => {
            // 1. Create an order for the user
            const orderRes = await pool.query(
                `INSERT INTO orders (user_id, items, total_sum)
                 VALUES ($1, $2, $3)
                 RETURNING id`,
                [testUser.id, JSON.stringify([{ product: 'Belongs to User', quantity: 1 }]), 10.00]
            );
            const orderId = orderRes.rows[0].id;

            // 2. Request it as the user
            const res = await request(app)
                .get(`/api/v1/orders/${orderId}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.id).toBe(orderId);
        });

        it('should return the order if requested by an admin', async () => {
            // 1. Create an order for the user
            const orderRes = await pool.query(
                `INSERT INTO orders (user_id, items, total_sum)
                 VALUES ($1, $2, $3)
                 RETURNING id`,
                [testUser.id, JSON.stringify([{ product: 'Belongs to User', quantity: 1 }]), 10.00]
            );
            const orderId = orderRes.rows[0].id;

            // 2. Request it as an admin
            const res = await request(app)
                .get(`/api/v1/orders/${orderId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.id).toBe(orderId);
        });

        it('should return 403 Forbidden if requested by another user who is not an admin', async () => {
            // 1. Create an order that belongs to the admin
            const orderRes = await pool.query(
                `INSERT INTO orders (user_id, items, total_sum)
                 VALUES ($1, $2, $3)
                 RETURNING id`,
                [testAdmin.id, JSON.stringify([{ product: 'Belongs to Admin', quantity: 1 }]), 10.00]
            );
            const orderId = orderRes.rows[0].id;

            // 2. Try to access it as the regular user
            const res = await request(app)
                .get(`/api/v1/orders/${orderId}`)
                .set('Authorization', `Bearer ${userToken}`);

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
