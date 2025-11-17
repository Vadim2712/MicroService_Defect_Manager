import request from 'supertest';
import app from '../index.js';
import { pool } from '../db.js';

describe('Auth Routes', () => {
    // Clean up the database before and after each test
    beforeEach(async () => {
        await pool.query('DELETE FROM users');
    });

    afterAll(async () => {
        await pool.end();
    });

    describe('POST /api/v1/auth/register', () => {
        it('should register a new user successfully', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                    firstName: 'Test',
                    lastName: 'User'
                });

            expect(response.statusCode).toBe(201);
            expect(response.body.data.message).toBe('User registered successfully');
            expect(response.body.data.user).toHaveProperty('id');
            expect(response.body.data.user.email).toBe('test@example.com');
        });

        it('should return an error if the email already exists', async () => {
            // First, register a user
            await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                    firstName: 'Test',
                    lastName: 'User'
                });

            // Then, try to register the same user again
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                    firstName: 'Test',
                    lastName: 'User'
                });

            expect(response.statusCode).toBe(409);
            expect(response.body.error.code).toBe('conflict');
            expect(response.body.error.message).toBe('User with this email already exists');
        });
    });
});
