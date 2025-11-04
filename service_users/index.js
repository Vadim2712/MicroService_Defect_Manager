import express from 'express'
import dotenv from 'dotenv'
import pino from 'pino'
import { v4 as uuid } from 'uuid'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

dotenv.config()
const app = express()
const logger = pino({ transport: { target: 'pino-pretty' } })
app.use(express.json())

const users = []
const JWT_SECRET = process.env.JWT_SECRET || 'changeme'

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6)
})

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6)
})

function generateToken(user) {
    return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '2h' })
}

function authMiddleware(req, res, next) {
    const header = req.headers.authorization
    if (!header) return res.status(401).json({ success: false, error: { code: 'NO_TOKEN', message: 'Token required' } })
    const token = header.split(' ')[1]
    try {
        req.user = jwt.verify(token, JWT_SECRET)
        next()
    } catch {
        res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Token invalid or expired' } })
    }
}

app.post('/v1/auth/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } })
    const { email, password } = parsed.data
    if (users.find(u => u.email === email)) return res.status(409).json({ success: false, error: { code: 'EMAIL_EXISTS', message: 'User already exists' } })
    const hashed = await bcrypt.hash(password, 10)
    const user = { id: uuid(), email, password: hashed }
    users.push(user)
    logger.info(`User registered: ${email}`)
    res.json({ success: true, data: { id: user.id, email: user.email } })
})

app.post('/v1/auth/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } })
    const { email, password } = parsed.data
    const user = users.find(u => u.email === email)
    if (!user) return res.status(401).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } })
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ success: false, error: { code: 'WRONG_PASSWORD', message: 'Incorrect password' } })
    const token = generateToken(user)
    res.json({ success: true, data: { token } })
})

app.get('/v1/users/me', authMiddleware, (req, res) => {
    const user = users.find(u => u.id === req.user.id)
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } })
    res.json({ success: true, data: { id: user.id, email: user.email } })
})

app.get('/health', (_, res) => res.json({ success: true, data: 'ok' }))

const PORT = process.env.PORT || 8000
app.listen(PORT, '0.0.0.0', () => logger.info(`service_users listening on ${PORT}`))
