import { Router } from 'express'

import {
  createBreakfastController,
  type BreakfastOperations,
} from '../controllers/breakfast.controller.js'
import { createRequireAuth } from '../middleware/require-auth.js'
import { SupabaseAuthSessionRepository } from '../repositories/auth-session.repository.js'
import { SupabaseBreakfastRepository } from '../repositories/breakfast.repository.js'
import { BreakfastService } from '../services/breakfast.service.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../services/family-session.service.js'

export function createBreakfastRouter(
  service: BreakfastOperations,
  sessionService: FamilySessionOperations,
): Router {
  const breakfastRouter = Router()
  const controller = createBreakfastController(service)

  breakfastRouter.use(createRequireAuth(sessionService))
  breakfastRouter.get('/catalog', controller.getCatalog)
  breakfastRouter.get('/days/:date', controller.getDay)
  breakfastRouter.put('/days/:date/response', controller.saveResponse)

  return breakfastRouter
}

const sessionService = new FamilySessionService(
  new SupabaseAuthSessionRepository(),
)
const breakfastService = new BreakfastService(
  new SupabaseBreakfastRepository(),
)

export default createBreakfastRouter(breakfastService, sessionService)
