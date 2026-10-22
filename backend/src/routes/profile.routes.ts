import { Router } from 'express'
import { createRequireAuth } from '../middleware/require-auth.js'
import { createProfileController } from '../controllers/profile.controller.js'
import { ProfileService } from '../services/profile.service.js'
import { SupabaseProfileRepository } from '../repositories/profile.repository.js'
import { SupabaseFamilyAuthRepository } from '../repositories/family-auth.repository.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../services/family-session.service.js'
import { SupabaseAuthSessionRepository } from '../repositories/auth-session.repository.js'
export function createProfileRouter(
  service: ProfileService,
  sessions: FamilySessionOperations,
) {
  const r = Router(),
    c = createProfileController(service)
  r.use(createRequireAuth(sessions))
  r.get('/me', c.summary)
  r.put('/me', c.update)
  r.post('/me/pin', c.change)
  r.get('/members', c.members)
  r.post('/members/:memberId/pin-reset', c.reset)
  return r
}
export default createProfileRouter(
  new ProfileService(
    new SupabaseProfileRepository(),
    new SupabaseFamilyAuthRepository(),
  ),
  new FamilySessionService(new SupabaseAuthSessionRepository()),
)
