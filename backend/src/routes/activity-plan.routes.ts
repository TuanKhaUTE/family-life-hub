import { Router } from 'express'
import { createRequireAuth } from '../middleware/require-auth.js'
import { createActivityPlanController } from '../controllers/activity-plan.controller.js'
import { ActivityPlanService } from '../services/activity-plan.service.js'
import { SupabaseActivityPlanRepository } from '../repositories/activity-plan.repository.js'
import { FamilySessionService, type FamilySessionOperations } from '../services/family-session.service.js'
import { SupabaseAuthSessionRepository } from '../repositories/auth-session.repository.js'
export function createActivityPlanRouter(service: ActivityPlanService, sessions: FamilySessionOperations) {
  const router = Router().use(createRequireAuth(sessions)), c = createActivityPlanController(service)
  router.get('/', c.read); router.post('/', c.save); router.put('/:id', c.save)
  router.post('/:id/completion', c.complete); router.patch('/:id/completion', c.complete); router.delete('/:id', c.cancel)
  return router
}
export default createActivityPlanRouter(new ActivityPlanService(new SupabaseActivityPlanRepository()), new FamilySessionService(new SupabaseAuthSessionRepository()))
