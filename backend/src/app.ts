import cors from 'cors'
import express from 'express'

import healthRouter from './routes/health.routes.js'

const app = express()

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5174',
  }),
)
app.use('/api', healthRouter)

export default app
