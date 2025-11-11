import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../db.js'

const router = express.Router()
const SECRET_KEY = process.env.JWT_SECRET || 'secretkey'

router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email || !password) return res.status(400).json({ message: 'Email и пароль обязательны' })

        const existing = await pool.query('SELECT * FROM users WHERE email=$1', [email])
        if (existing.rows.length > 0) return res.status(400).json({ message: 'Пользователь уже существует' })

        const hash = await bcrypt.hash(password, 10)
        await pool.query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, hash])
        res.status(201).json({ message: 'Пользователь зарегистрирован' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Ошибка регистрации' })
    }
})

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body
        const result = await pool.query('SELECT * FROM users WHERE email=$1', [email])
        const user = result.rows[0]
        if (!user) return res.status(400).json({ message: 'Неверный email или пароль' })

        const valid = await bcrypt.compare(password, user.password)
        if (!valid) return res.status(400).json({ message: 'Неверный email или пароль' })

        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' })
        res.json({ token })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Ошибка входа' })
    }
})

router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization
        if (!authHeader) return res.status(401).json({ message: 'Нет токена' })

        const token = authHeader.split(' ')[1]
        const decoded = jwt.verify(token, SECRET_KEY)
        const result = await pool.query('SELECT id, email FROM users WHERE id=$1', [decoded.id])
        res.json(result.rows[0])
    } catch (err) {
        console.error(err)
        res.status(401).json({ message: 'Недействительный токен' })
    }
})

router.put('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization
        if (!authHeader) return res.status(401).json({ message: 'Нет токена' })

        const token = authHeader.split(' ')[1]
        const decoded = jwt.verify(token, SECRET_KEY)
        const { email } = req.body

        await pool.query('UPDATE users SET email=$1 WHERE id=$2', [email, decoded.id])
        res.json({ message: 'Email обновлён' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Ошибка обновления профиля' })
    }
})

export default router
