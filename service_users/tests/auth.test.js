import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../index.js';
import { pool } from '../db.js';

describe('Auth Routes', () => {
    beforeEach(async () => {
        await pool.query('DELETE FROM users');
    });

    afterAll(async () => {
        await pool.end();
    });

    describe('POST /api/v1/auth/register', () => {
        it('should register a new user successfully', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                    name: 'Test User'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.user).toHaveProperty('id');
            expect(res.body.data.user.email).toBe('test@example.com');
            expect(res.body.data.message).toBe('User registered successfully');
        });

        it('should return an error if the email already exists', async () => {
            await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                    name: 'Test User'
                });

            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                    name: 'Test User'
                });

            expect(res.statusCode).toBe(409);
            expect(res.body.error.code).toBe('conflict');
            expect(res.body.error.message).toBe('User with this email already exists');
        });

        it('should return a validation error for short password', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'test@example.com',
                    password: '123',
                    name: 'Test User'
                });
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error.code).toBe('validation_error');
        });
    });

    describe('POST /api/v1/auth/login', () => {
        const userPassword = 'password123';
        let userEmail;

        beforeEach(async () => {
            userEmail = 'login-test@example.com';
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(userPassword, salt);
            await pool.query(
                'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)',
                [userEmail, passwordHash, 'Login Test User']
            );
        });

        it('should login a user successfully and return a token', async () => {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: userEmail,
                    password: userPassword,
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toHaveProperty('token');
            expect(res.body.data.user.email).toBe(userEmail);
        });

        it('should return an error for invalid credentials (wrong password)', async () => {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: userEmail,
                    password: 'wrongpassword',
                });

            expect(res.statusCode).toBe(401);
            expect(res.body.error.code).toBe('invalid_credentials');
            expect(res.body.error.message).toBe('Invalid email or password');
        });

        it('should return an error for invalid credentials (user not found)', async () => {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'not-found@example.com',
                    password: 'password123',
                });

            expect(res.statusCode).toBe(401);
            expect(res.body.error.code).toBe('invalid_credentials');
            expect(res.body.error.message).toBe('Invalid email or password');
        });
    });
});
