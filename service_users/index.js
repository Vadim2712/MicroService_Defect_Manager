import express from 'express'
import dotenv from 'dotenv'
import bodyParser from 'body-parser'
import { pool } from './db.js'
import authRoutes from './routes/auth.js'

dotenv.config()
const app = express()
app.use(bodyParser.json())

app.use('/v1/auth', authRoutes)

app.get('/', (req, res) => res.send('User Service Running'))

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`User service running on port ${PORT}`))
