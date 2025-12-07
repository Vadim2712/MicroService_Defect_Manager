const { Pool } = require('pg');
const pino = require('pino')();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.on('connect', () => {
  pino.info('Соединение с базой данных установлено');
});

pool.on('error', (err) => {
  pino.error('Ошибка соединения с базой данных', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
