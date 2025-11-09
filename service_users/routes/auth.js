import express from 'express'
import bcrypt from 'bcryptjs'
import pool from '../db.js'

const router = express.Router()

router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body
        const hashedPassword = await bcrypt.hash(password, 10)
        const result = await pool.query(
            'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
            [username, email, hashedPassword]
        )
        res.status(201).json({ message: 'User registered successfully', user: result.rows[0] })
    } catch (err) {
        console.error('Register error:', err)
        res.status(500).json({ error: 'Internal server error' })
    }
})

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
        if (result.rows.length === 0) return res.status(400).json({ error: 'User not found' })
        const user = result.rows[0]
        const match = await bcrypt.compare(password, user.password)
        if (!match) return res.status(401).json({ error: 'Invalid password' })
        res.json({ message: 'Login successful', user: { id: user.id, username: user.username, email: user.email } })
    } catch (err) {
        console.error('Login error:', err)
        res.status(500).json({ error: 'Internal server error' })
    }
})

export default router
