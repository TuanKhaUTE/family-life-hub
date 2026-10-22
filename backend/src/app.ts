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
import homeRouter from './routes/home.routes.js'
import calendarRouter from './routes/calendar.routes.js'
import choreRouter from './routes/chore.routes.js'
import studyRouter from './routes/study.routes.js'
import fitnessRouter from './routes/fitness.routes.js'
import wellnessRouter from './routes/wellness.routes.js'
import personalExpenseRouter from './routes/personal-expense.routes.js'

const app = express()

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5174',
  }),
)
app.use(express.json())
app.use('/api', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/home', homeRouter)
app.use('/api/calendar', calendarRouter)
app.use('/api/chores', choreRouter)
app.use('/api/study', studyRouter)
app.use('/api/fitness', fitnessRouter)
app.use('/api/wellness', wellnessRouter)
app.use('/api/expenses/personal', personalExpenseRouter)
app.use('/api/breakfast', breakfastRouter)
app.use('/api/notifications', notificationRouter)
app.use('/api/meals/requests', mealRequestRouter)
app.use('/api/meals', dishRatingRouter)
app.use('/api/meals/final', finalMealRouter)
app.use(errorHandler)

export default app
