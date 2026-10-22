import { Router } from 'express'
import { createRequireAuth } from '../middleware/require-auth.js'
import { createWellnessController } from '../controllers/wellness.controller.js'
import { WellnessService } from '../services/wellness.service.js'
import { SupabaseWellnessRepository } from '../repositories/wellness.repository.js'
import { SupabaseAuthSessionRepository } from '../repositories/auth-session.repository.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../services/family-session.service.js'

export function createWellnessRouter(
  service: WellnessService,
  sessions: FamilySessionOperations,
) {
  const router = Router(),
    controller = createWellnessController(service)
  router.use(createRequireAuth(sessions))
  router.get('/', controller.read)
  router.put('/profile', controller.saveProfile)
  router.delete('/profile', controller.removeProfile)
  router.post('/logs', controller.saveLog)
  router.put('/logs/:id', controller.saveLog)
  router.delete('/logs/:id', controller.removeLog)
  return router
}
export default createWellnessRouter(
  new WellnessService(new SupabaseWellnessRepository()),
  new FamilySessionService(new SupabaseAuthSessionRepository()),
)
