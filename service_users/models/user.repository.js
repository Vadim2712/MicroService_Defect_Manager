import { pool } from '../db.js';

export const createUser = async (email, passwordHash, name, roles = ['user']) => {
    const res = await pool.query(
        'INSERT INTO users (email, password_hash, name, roles) VALUES ($1, $2, $3, $4) RETURNING id, email, name, roles, created_at, updated_at',
        [email, passwordHash, name || null, roles]
    );
    return res.rows[0];
};

export const findUserByEmail = async (email) => {
    const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return res.rows[0];
};

export const findUserById = async (id) => {
    const res = await pool.query('SELECT id, email, name, roles, created_at, updated_at FROM users WHERE id = $1', [id]);
    return res.rows[0];
};

export const updateUser = async (id, name, email, roles) => {
    const res = await pool.query(
        'UPDATE users SET name = $1, email = $2, roles = $3 WHERE id = $4 RETURNING id, email, name, roles, created_at, updated_at',
        [name, email, roles, id]
    );
    return res.rows[0];
};

export const findAllUsers = async (limit, offset, filter) => {
    let query = 'SELECT id, email, name, roles, created_at, updated_at FROM users';
    const queryParams = [];
    let paramIndex = 1;

    if (filter) {
        query += ' WHERE email ILIKE $' + paramIndex;
        queryParams.push(`%${filter}%`);
        paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const res = await pool.query(query, queryParams);

    const totalRes = await pool.query('SELECT COUNT(*) FROM users' + (filter ? ' WHERE email ILIKE $1' : ''), filter ? [`%${filter}%`] : []);
    const total = parseInt(totalRes.rows[0].count, 10);

    return { users: res.rows, total };
};