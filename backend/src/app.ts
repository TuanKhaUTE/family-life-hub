import cors from 'cors'
import express from 'express'

import { errorHandler } from './middleware/error-handler.js'
import authRouter from './routes/auth.routes.js'
import breakfastRouter from './routes/breakfast.routes.js'
import healthRouter from './routes/health.routes.js'
import notificationRouter from './routes/notification.routes.js'
import mealRequestRouter from './routes/meal-request.routes.js'
import finalMealRouter from './routes/final-meal.routes.js'
import dishRatingRouter from './routes/dish-rating.routes.js'

const app = express()

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5174',
  }),
)
app.use(express.json())
app.use('/api', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/breakfast', breakfastRouter)
app.use('/api/notifications', notificationRouter)
app.use('/api/meals/requests', mealRequestRouter)
app.use('/api/meals', dishRatingRouter)
app.use('/api/meals/final', finalMealRouter)
app.use(errorHandler)

export default app
