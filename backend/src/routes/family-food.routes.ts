import { Router } from 'express'
import { createRequireAuth } from '../middleware/require-auth.js'
import { createFamilyFoodController } from '../controllers/family-food.controller.js'
import { FamilyFoodService } from '../services/family-food.service.js'
import { SupabaseFamilyFoodRepository } from '../repositories/family-food.repository.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../services/family-session.service.js'
import { SupabaseAuthSessionRepository } from '../repositories/auth-session.repository.js'
import { FinalMealService } from '../services/final-meal.service.js'
import { BreakfastService } from '../services/breakfast.service.js'
import { SupabaseFinalMealRepository } from '../repositories/final-meal.repository.js'
import { SupabaseBreakfastRepository } from '../repositories/breakfast.repository.js'
export function createFamilyFoodRouter(
  service: FamilyFoodService,
  sessions: FamilySessionOperations,
) {
  const r = Router(),
    c = createFamilyFoodController(service)
  r.use(createRequireAuth(sessions))
  r.get('/', c.read)
  r.get('/summary', c.summary)
  r.get('/slot', c.slot)
  r.get('/prefill', c.prefill)
  r.post('/', c.save)
  r.put('/:id', c.save)
  r.delete('/:id', c.remove)
  return r
}
export default createFamilyFoodRouter(
  new FamilyFoodService(new SupabaseFamilyFoodRepository(), {
    dinner: new FinalMealService(new SupabaseFinalMealRepository()),
    breakfast: new BreakfastService(new SupabaseBreakfastRepository()),
  }),
  new FamilySessionService(new SupabaseAuthSessionRepository()),
)
