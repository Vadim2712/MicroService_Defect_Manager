const request = require('supertest');
const app = require('../app');
const db = require('../db/database');
const bcrypt = require('bcryptjs');

// Mock the db module
jest.mock('../db/database');


describe('User Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /register', () => {
    it('should register a new user', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // No existing user
      db.query.mockResolvedValueOnce({ rows: [{ id: 'some-uuid' }] }); // Successful insert

      const res = await request(app)
        .post('/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
    });

    it('should return 409 if user already exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'some-uuid' }] }); // User exists

      const res = await request(app)
        .post('/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toEqual(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('POST /login', () => {
    it('should login an existing user', async () => {
      const hashedPassword = bcrypt.hashSync('password123', 8);
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'some-uuid',
          email: 'test@example.com',
          password: hashedPassword,
          roles: ['user'],
        }],
      });

      const res = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
    });

    it('should return 401 for invalid credentials', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // User not found

      const res = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
