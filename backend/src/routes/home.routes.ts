import { Router } from 'express'
import { ActivityPlanService } from '../services/activity-plan.service.js'
import { SupabaseActivityPlanRepository } from '../repositories/activity-plan.repository.js'
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
import { HouseholdDutyService } from '../services/household-duty.service.js'
import { SupabaseHouseholdDutyRepository } from '../repositories/household-duty.repository.js'
import { StudyService } from '../services/study.service.js'
import { SupabaseStudyRepository } from '../repositories/study.repository.js'
import { FitnessService } from '../services/fitness.service.js'
import { SupabaseFitnessRepository } from '../repositories/fitness.repository.js'
import { PersonalExpenseService } from '../services/personal-expense.service.js'
import { SupabasePersonalExpenseRepository } from '../repositories/personal-expense.repository.js'
import { FamilyFoodService } from '../services/family-food.service.js'
import { SupabaseFamilyFoodRepository } from '../repositories/family-food.repository.js'

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
    activities: new ActivityPlanService(new SupabaseActivityPlanRepository()),
    familyFood: new FamilyFoodService(new SupabaseFamilyFoodRepository()),
    breakfast: new BreakfastService(new SupabaseBreakfastRepository()),
    requests: new MealRequestService(new SupabaseMealRequestRepository()),
    meals: new FinalMealService(new SupabaseFinalMealRepository()),
    ratings: new DishRatingService(new SupabaseDishRatingRepository()),
    recent: new SupabaseHomeRepository(),
    calendar: new CalendarService(new SupabaseCalendarRepository()),
    household: new HouseholdDutyService(new SupabaseHouseholdDutyRepository()),
    study: new StudyService(new SupabaseStudyRepository()),
    fitness: new FitnessService(new SupabaseFitnessRepository()),
    expenses: new PersonalExpenseService(
      new SupabasePersonalExpenseRepository(),
    ),
  }),
  new FamilySessionService(new SupabaseAuthSessionRepository()),
)
