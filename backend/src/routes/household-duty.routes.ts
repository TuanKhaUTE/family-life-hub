import { Router } from 'express'
import { createHouseholdDutyController } from '../controllers/household-duty.controller.js'
import { createRequireAuth } from '../middleware/require-auth.js'
import { HouseholdDutyService } from '../services/household-duty.service.js'
import { SupabaseHouseholdDutyRepository } from '../repositories/household-duty.repository.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../services/family-session.service.js'
import { SupabaseAuthSessionRepository } from '../repositories/auth-session.repository.js'

export function createHouseholdDutyRouter(
  service: HouseholdDutyService,
  sessions: FamilySessionOperations,
) {
  const router = Router().use(createRequireAuth(sessions))
  const controller = createHouseholdDutyController(service)
  router.get('/', controller.list)
  router.put('/week', controller.save)
  router.post('/duplicate-week', controller.duplicate)
  router.post('/:date/complete', controller.complete)
  router.delete('/:date', controller.cancel)
  return router
}
export default createHouseholdDutyRouter(
  new HouseholdDutyService(new SupabaseHouseholdDutyRepository()),
  new FamilySessionService(new SupabaseAuthSessionRepository()),
)
