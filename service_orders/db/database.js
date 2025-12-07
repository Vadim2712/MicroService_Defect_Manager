const { Pool } = require('pg');
const pino = require('pino')();

class Database {
    constructor(config) {
        this.pool = new Pool(config);
        this.pool.on('connect', () => {
            pino.info('Соединение с базой данных установлено');
        });
        this.pool.on('error', (err) => {
            pino.error('Ошибка соединения с базой данных', err);
        });
    }

    query(text, params) {
        return this.pool.query(text, params);
    }

    end() {
        return this.pool.end();
    }
}

const db = new Database({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

module.exports = { db, Database };
