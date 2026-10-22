import { Router } from 'express'
import { createRequireAuth } from '../middleware/require-auth.js'
import { createFitnessController } from '../controllers/fitness.controller.js'
import { FitnessService } from '../services/fitness.service.js'
import { SupabaseFitnessRepository } from '../repositories/fitness.repository.js'
import { SupabaseAuthSessionRepository } from '../repositories/auth-session.repository.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../services/family-session.service.js'
export function createFitnessRouter(
  service: FitnessService,
  sessions: FamilySessionOperations,
) {
  const router = Router(),
    c = createFitnessController(service)
  router.use(createRequireAuth(sessions))
  router.get('/', c.read)
  router.post('/:kind', c.save)
  router.put('/:kind/:id', c.save)
  router.delete('/:kind/:id', c.remove)
  return router
}
export default createFitnessRouter(
  new FitnessService(new SupabaseFitnessRepository()),
  new FamilySessionService(new SupabaseAuthSessionRepository()),
)
