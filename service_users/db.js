import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
    user: process.env.DB_USER || 'SysAdminMicroServ',
    host: process.env.DB_HOST || 'postgres',
    database: process.env.DB_NAME || 'microservices_db',
    password: process.env.DB_PASSWORD || '12345678',
    port: process.env.DB_PORT || 5432,
});

pool.on('connect', () => {
    console.log('User-Service: Connected to the database');
});

pool.on('error', (err) => {
    console.error('User-Service: Database connection error:', err.stack);
});