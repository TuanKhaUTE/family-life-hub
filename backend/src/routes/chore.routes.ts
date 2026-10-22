import { Router } from 'express'
import { createRequireAuth } from '../middleware/require-auth.js'
import { createChoreController } from '../controllers/chore.controller.js'
import { ChoreService } from '../services/chore.service.js'
import { SupabaseChoreRepository } from '../repositories/chore.repository.js'
import { SupabaseAuthSessionRepository } from '../repositories/auth-session.repository.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../services/family-session.service.js'
export function createChoreRouter(
  service: ChoreService,
  sessions: FamilySessionOperations,
) {
  const router = Router(),
    controller = createChoreController(service)
  router.use(createRequireAuth(sessions))
  router.get('/', controller.list)
  router.post('/schedules', controller.create)
  router.put('/schedules/:id', controller.update)
  router.delete('/schedules/:id', controller.cancel)
  router.post('/schedules/:id/occurrences/:date/complete', controller.complete)
  router.post(
    '/schedules/:id/occurrences/:date/cancel',
    controller.cancelOccurrence,
  )
  return router
}
export default createChoreRouter(
  new ChoreService(new SupabaseChoreRepository()),
  new FamilySessionService(new SupabaseAuthSessionRepository()),
)
