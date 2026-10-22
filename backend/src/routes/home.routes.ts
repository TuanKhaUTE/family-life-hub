import { Router } from 'express'
import { createHomeController } from '../controllers/home.controller.js'
import { createRequireAuth } from '../middleware/require-auth.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../services/family-session.service.js'
import { SupabaseAuthSessionRepository } from '../repositories/auth-session.repository.js'
import { SupabaseBreakfastRepository } from '../repositories/breakfast.repository.js'
import { SupabaseMealRequestRepository } from '../repositories/meal-request.repository.js'
import { SupabaseFinalMealRepository } from '../repositories/final-meal.repository.js'
import { SupabaseDishRatingRepository } from '../repositories/dish-rating.repository.js'
import { SupabaseHomeRepository } from '../repositories/home.repository.js'
import { BreakfastService } from '../services/breakfast.service.js'
import { MealRequestService } from '../services/meal-request.service.js'
import { FinalMealService } from '../services/final-meal.service.js'
import { DishRatingService } from '../services/dish-rating.service.js'
import { HomeService } from '../services/home.service.js'
import { CalendarService } from '../services/calendar.service.js'
import { SupabaseCalendarRepository } from '../repositories/calendar.repository.js'
import { ChoreService } from '../services/chore.service.js'
import { SupabaseChoreRepository } from '../repositories/chore.repository.js'
import { StudyService } from '../services/study.service.js'
import { SupabaseStudyRepository } from '../repositories/study.repository.js'

export function createHomeRouter(
  service: HomeService,
  sessions: FamilySessionOperations,
) {
  const router = Router()
  router.get('/', createRequireAuth(sessions), createHomeController(service))
  return router
}
export default createHomeRouter(
  new HomeService({
    breakfast: new BreakfastService(new SupabaseBreakfastRepository()),
    requests: new MealRequestService(new SupabaseMealRequestRepository()),
    meals: new FinalMealService(new SupabaseFinalMealRepository()),
    ratings: new DishRatingService(new SupabaseDishRatingRepository()),
    recent: new SupabaseHomeRepository(),
    calendar: new CalendarService(new SupabaseCalendarRepository()),
    chores: new ChoreService(new SupabaseChoreRepository()),
    study: new StudyService(new SupabaseStudyRepository()),
  }),
  new FamilySessionService(new SupabaseAuthSessionRepository()),
)
