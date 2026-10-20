import cors from 'cors'
import express from 'express'

import { errorHandler } from './middleware/error-handler.js'
import authRouter from './routes/auth.routes.js'
import healthRouter from './routes/health.routes.js'

const app = express()

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5174',
  }),
)
app.use(express.json())
app.use('/api', healthRouter)
app.use('/api/auth', authRouter)
app.use(errorHandler)

export default app
