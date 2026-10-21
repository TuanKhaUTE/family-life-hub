import { Router } from 'express'
import {
  createMealRequestController,
  type MealRequestOperations,
} from '../controllers/meal-request.controller.js'
import { createRequireAuth } from '../middleware/require-auth.js'
import { SupabaseAuthSessionRepository } from '../repositories/auth-session.repository.js'
import { SupabaseMealRequestRepository } from '../repositories/meal-request.repository.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../services/family-session.service.js'
import { MealRequestService } from '../services/meal-request.service.js'

export function createMealRequestRouter(
  service: MealRequestOperations,
  sessions: FamilySessionOperations,
): Router {
  const router = Router()
  const controller = createMealRequestController(service)
  router.use(createRequireAuth(sessions))
  router.get('/current', controller.listCurrent)
  router.post('/', controller.create)
  router.patch('/:id', controller.update)
  router.put('/:id/response', controller.saveResponse)
  return router
}

export default createMealRequestRouter(
  new MealRequestService(new SupabaseMealRequestRepository()),
  new FamilySessionService(new SupabaseAuthSessionRepository()),
)
