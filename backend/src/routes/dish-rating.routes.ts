import { Router } from 'express'
import { createDishRatingController } from '../controllers/dish-rating.controller.js'
import { createRequireAuth } from '../middleware/require-auth.js'
import { SupabaseAuthSessionRepository } from '../repositories/auth-session.repository.js'
import { SupabaseDishRatingRepository } from '../repositories/dish-rating.repository.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../services/family-session.service.js'
import { DishRatingService } from '../services/dish-rating.service.js'

export function createDishRatingRouter(
  service: DishRatingService,
  sessions: FamilySessionOperations,
): Router {
  const router = Router()
  const controller = createDishRatingController(service)
  const auth = createRequireAuth(sessions)
  router.get('/final/:mealId/ratings', auth, controller.get)
  router.put('/dishes/:dishId/rating', auth, controller.save)
  return router
}
export default createDishRatingRouter(
  new DishRatingService(new SupabaseDishRatingRepository()),
  new FamilySessionService(new SupabaseAuthSessionRepository()),
)
