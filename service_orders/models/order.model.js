import { pool } from '../db.js';

export const createOrder = async (userId, items, totalSum) => {
    const res = await pool.query(
        'INSERT INTO orders (user_id, items, total_sum, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, JSON.stringify(items), totalSum, 'created']
    );
    return res.rows[0];
};

export const findOrderById = async (id) => {
    const res = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    return res.rows[0];
};

export const findOrdersByUserId = async (userId, userRoles, limit, offset, sortBy, sortOrder) => {
    const validSortColumns = ['created_at', 'status', 'total_sum'];
    const validSortOrders = ['ASC', 'DESC'];

    const sort = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    const isAdmin = userRoles.includes('admin');

    let query = `
    SELECT * FROM orders 
    ${isAdmin ? '' : 'WHERE user_id = $1'}
    ORDER BY ${sort} ${order} 
    LIMIT $${isAdmin ? '1' : '2'} OFFSET $${isAdmin ? '2' : '3'}
  `;

    const queryParams = isAdmin ? [limit, offset] : [userId, limit, offset];
    const res = await pool.query(query, queryParams);

    const totalQuery = `SELECT COUNT(*) FROM orders ${isAdmin ? '' : 'WHERE user_id = $1'}`;
    const totalParams = isAdmin ? [] : [userId];
    const totalRes = await pool.query(totalQuery, totalParams);
    const total = parseInt(totalRes.rows[0].count, 10);

    return { orders: res.rows, total };
};

export const updateOrderStatus = async (id, status) => {
    const res = await pool.query(
        'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
        [status, id]
    );
    return res.rows[0];
};