import { Router } from 'express'
import {
  createFinalMealController,
  type FinalMealOperations,
} from '../controllers/final-meal.controller.js'
import { createRequireAuth } from '../middleware/require-auth.js'
import { SupabaseAuthSessionRepository } from '../repositories/auth-session.repository.js'
import { SupabaseFinalMealRepository } from '../repositories/final-meal.repository.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../services/family-session.service.js'
import { FinalMealService } from '../services/final-meal.service.js'

export function createFinalMealRouter(
  service: FinalMealOperations,
  sessions: FamilySessionOperations,
): Router {
  const router = Router()
  const controller = createFinalMealController(service)
  router.use(createRequireAuth(sessions))
  router.get('/:date/:type', controller.get)
  router.put('/:date/:type', controller.save)
  router.put('/:date/:type/ready', controller.ready)
  return router
}
export default createFinalMealRouter(
  new FinalMealService(new SupabaseFinalMealRepository()),
  new FamilySessionService(new SupabaseAuthSessionRepository()),
)
