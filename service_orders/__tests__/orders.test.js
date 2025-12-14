const request = require('supertest');
const createApp = require('../index');
const { Database } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

const testUserId = uuidv4();
const otherUserId = uuidv4();
let server;
let testDb;
let app;
let testOrder;

beforeAll((done) => {
  const dbConfig = {
    user: process.env.DB_USER || 'user',
    host: 'localhost', // Connect to localhost for tests
    database: process.env.DB_NAME || 'app_db',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
  };

  testDb = new Database(dbConfig);

  app = createApp(testDb);

  server = app.listen(0, () => { // Listen on a random available port
    console.log(`Test server running on port ${server.address().port}`);
    done();
  });
});

// Clean up after all tests are done
afterAll(async () => {
  await testDb.end();
  await server.close();
});

describe('Order Service API', () => {
  // Setup: Create a user and an order before tests run
  beforeAll(async () => {
    // Clean up existing test data, respecting foreign key constraints
    await testDb.query('DELETE FROM orders');
    await testDb.query('DELETE FROM users');

    // Create users for testing
    await testDb.query('INSERT INTO users (id, name, email, password, roles) VALUES ($1, $2, $3, $4, $5)', [testUserId, 'Test User', 'test@test.com', 'password', '{user}']);
    await testDb.query('INSERT INTO users (id, name, email, password, roles) VALUES ($1, $2, $3, $4, $5)', [otherUserId, 'Other User', 'other@test.com', 'password', '{user}']);

    // Create an order for testing
    const orderData = {
      id: uuidv4(),
      userId: testUserId,
      items: [{ product: 'Test Product', quantity: 1 }],
      status: 'created',
      totalAmount: 100,
    };
    const { rows } = await testDb.query(
      'INSERT INTO orders (id, "userId", items, status, "totalAmount") VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [orderData.id, orderData.userId, JSON.stringify(orderData.items), orderData.status, orderData.totalAmount]
    );
    testOrder = rows[0];
  });

  // Teardown: Clean up database after all tests
  afterAll(async () => {
    // Clean up existing test data, respecting foreign key constraints
    await testDb.query('DELETE FROM orders');
    await testDb.query('DELETE FROM users');
  });


  describe('POST /', () => {
    it('should create a new order for an authenticated user', async () => {
      const newOrder = {
        items: [{ product: 'New Product', quantity: 2 }],
        totalAmount: 200,
      };

      const res = await request(server)
        .post('/')
        .set('x-user-id', testUserId)
        .send(newOrder);

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.status).toBe('created');
      expect(res.body.data['userId']).toBe(testUserId);
    });

    it('should return 401 if x-user-id header is missing', async () => {
      const newOrder = {
        items: [{ product: 'New Product', quantity: 2 }],
        totalAmount: 200,
      };

      const res = await request(server)
        .post('/')
        .send(newOrder);

      expect(res.statusCode).toEqual(401);
    });
  });

  describe('GET /', () => {
    it('should get a list of orders for the current user', async () => {
      const res = await request(server)
        .get('/')
        .set('x-user-id', testUserId);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]['userId']).toBe(testUserId);
    });
  });

  describe('GET /:id', () => {
    it('should get an order by ID for the owner', async () => {
      const res = await request(server)
        .get(`/${testOrder.id}`)
        .set('x-user-id', testUserId);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testOrder.id);
    });

    it('should return 403 if trying to get another user\'s order', async () => {
      const res = await request(server)
        .get(`/${testOrder.id}`)
        .set('x-user-id', otherUserId);

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('PATCH /:id', () => {
    it('should update the status of an order for the owner', async () => {
      const res = await request(server)
        .patch(`/${testOrder.id}`)
        .set('x-user-id', testUserId)
        .send({ status: 'completed' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
    });

    it('should return 403 if trying to update another user\'s order', async () => {
      const res = await request(server)
        .patch(`/${testOrder.id}`)
        .set('x-user-id', otherUserId)
        .send({ status: 'in_progress' });

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('DELETE /:id', () => {
    it('should cancel an order for the owner', async () => {
      const newOrderData = {
        id: uuidv4(),
        userId: testUserId,
        items: [{ product: 'To Be Cancelled', quantity: 1 }],
        status: 'created',
        totalAmount: 50,
      };
      const { rows } = await testDb.query(
        'INSERT INTO orders (id, "userId", items, status, "totalAmount") VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [newOrderData.id, newOrderData.userId, JSON.stringify(newOrderData.items), newOrderData.status, newOrderData.totalAmount]
      );
      const orderToCancel = rows[0];

      const res = await request(server)
        .delete(`/${orderToCancel.id}`)
        .set('x-user-id', testUserId);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('cancelled');
    });

    it('should return 403 if trying to cancel another user\'s order', async () => {
      const res = await request(server)
        .delete(`/${testOrder.id}`)
        .set('x-user-id', otherUserId);

      expect(res.statusCode).toEqual(403);
    });
  });
});
