require('./tracing');
const express = require('express');
const cors = require('cors');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pino = require('pino')();
const pinoHttp = require('pino-http');
const db = require('./db/database');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger: pino }));

// --- Схемы валидации ---
const registerSchema = z.object({
  name: z.string().min(2, "Имя должно содержать не менее 2 символов"),
  email: z.string().email("Неверный формат электронной почты"),
  password: z.string().min(6, "Пароль должен содержать не менее 6 символов"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
});


// --- Middleware для аутентификации ---
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Токен не предоставлен' } });
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [payload.id]);
        const user = rows[0];
        if (!user) {
            return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Пользователь не найден' } });
        }
        req.user = user;
        req.log = req.log.child({ userId: user.id });
        next();
    } catch (error) {
        res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Невалидный токен' } });
    }
};


// --- Маршруты ---

// Регистрация
app.post('/register', async (req, res) => {
    req.log.info({ body: req.body }, 'Запрос на регистрацию');
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
        const errorMessage = validation.error.issues.map(e => e.message).join(', ');
        req.log.error({ errors: validation.error.issues }, 'Ошибка валидации при регистрации');
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errorMessage } });
    }

    const { name, email, password } = validation.data;

    try {
        const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (rows.length > 0) {
            req.log.warn({ email }, 'Попытка регистрации с существующим email');
            return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Пользователь с таким email уже существует' } });
        }

        const hashedPassword = bcrypt.hashSync(password, 8);
        const newUser = {
            id: uuidv4(),
            name,
            email,
            password: hashedPassword,
            roles: ['user'],
        };

        await db.query(
            'INSERT INTO users (id, name, email, password, roles) VALUES ($1, $2, $3, $4, $5)',
            [newUser.id, newUser.name, newUser.email, newUser.password, newUser.roles]
        );

        req.log.info({ userId: newUser.id }, `Пользователь зарегистрирован`);
        res.status(201).json({ success: true, data: { id: newUser.id } });
    } catch (error) {
        req.log.error(error, 'Ошибка при регистрации пользователя');
        res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Внутренняя ошибка сервера' } });
    }
});

// Вход
app.post('/login', async (req, res) => {
    req.log.info({ body: req.body }, 'Запрос на вход');
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
        const errorMessage = validation.error.issues.map(e => e.message).join(', ');
        req.log.error({ errors: validation.error.issues }, 'Ошибка валидации при входе');
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errorMessage } });
    }

    const { email, password } = validation.data;

    try {
        const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = rows[0];

        if (!user || !bcrypt.compareSync(password, user.password)) {
            req.log.warn({ email }, 'Неудачная попытка входа');
            return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Неверный email или пароль' } });
        }

        const token = jwt.sign({ id: user.id, roles: user.roles }, JWT_SECRET, { expiresIn: '1h' });
        req.log.info({ userId: user.id }, `Пользователь вошел в систему`);
      
        res.json({ success: true, data: { token } });
    } catch (error) {
        req.log.error(error, 'Ошибка при входе');
        res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Внутренняя ошибка сервера' } });
    }
});

// Получение текущего профиля
app.get('/me', authMiddleware, (req, res) => {
    req.log.info('Запрос на получение профиля');
    const { password, ...userProfile } = req.user;
    res.json({ success: true, data: userProfile });
});

// Обновление профиля
app.patch('/me', authMiddleware, async (req, res) => {
    req.log.info({ body: req.body }, 'Запрос на обновление профиля');
    const validation = updateUserSchema.safeParse(req.body);
    if (!validation.success) {
        const errorMessage = validation.error.issues.map(e => e.message).join(', ');
        req.log.error({ errors: validation.error.issues }, 'Ошибка валидации при обновлении профиля');
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errorMessage } });
    }

    const { name, email } = validation.data;

    try {
        if (email) {
            const { rows } = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.user.id]);
            if (rows.length > 0) {
                req.log.warn({ email }, 'Попытка обновить на уже существующий email');
                return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Этот email уже используется другим пользователем' } });
            }
        }

        const newName = name || req.user.name;
        const newEmail = email || req.user.email;

        const { rows } = await db.query(
            'UPDATE users SET name = $1, email = $2, "updatedAt" = NOW() WHERE id = $3 RETURNING *',
            [newName, newEmail, req.user.id]
        );

        req.log.info(`Профиль обновлен`);
        const { password, ...userProfile } = rows[0];
        res.json({ success: true, data: userProfile });
    } catch (error) {
        req.log.error(error, 'Ошибка при обновлении профиля');
        res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Внутренняя ошибка сервера' } });
    }
});


// Получение списка пользователей (только для админа)
app.get('/', authMiddleware, async (req, res) => {
    req.log.info('Запрос на получение списка пользователей');
    if (!req.user.roles.includes('admin')) {
        req.log.warn('Попытка несанкционированного доступа к списку пользователей');
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Доступ запрещен' } });
    }

    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;
        const { email, name } = req.query;

        const queryParams = [];
        let whereClause = 'WHERE 1=1';

        if (email) {
            queryParams.push(`%${email}%`);
            whereClause += ` AND email ILIKE $${queryParams.length}`;
        }
        if (name) {
            queryParams.push(`%${name}%`);
            whereClause += ` AND name ILIKE $${queryParams.length}`;
        }

        const usersQuery = `SELECT id, name, email, roles, "createdAt", "updatedAt" FROM users ${whereClause} ORDER BY "createdAt" DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
        const totalQuery = `SELECT COUNT(*) FROM users ${whereClause}`;

        const { rows: users } = await db.query(usersQuery, [...queryParams, limit, offset]);
        const { rows: totalRows } = await db.query(totalQuery, queryParams);

        const total = parseInt(totalRows[0].count, 10);

        res.json({
            success: true,
            data: users,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        req.log.error(error, 'Ошибка при получении списка пользователей');
        res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Внутренняя ошибка сервера' } });
    }
});

// Health check
app.get('/health', (req, res) => {
    req.log.info('Health check');
    res.json({ status: 'OK', service: 'Users Service' });
});

module.exports = app;
