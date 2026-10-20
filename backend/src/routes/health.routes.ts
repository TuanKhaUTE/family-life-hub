import { Router } from 'express'

import {
  getDatabaseHealth,
  getHealth,
} from '../controllers/health.controller.js'

const healthRouter = Router()

healthRouter.get('/health', getHealth)
healthRouter.get('/health/database', getDatabaseHealth)

export default healthRouter
