import { Router } from 'express'
import { createRequireAuth } from '../middleware/require-auth.js'
import { createShareController } from '../controllers/share.controller.js'
import { ShareService } from '../services/share.service.js'
import { SupabaseShareRepository } from '../repositories/share.repository.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../services/family-session.service.js'
import { SupabaseAuthSessionRepository } from '../repositories/auth-session.repository.js'
export function createShareRouter(
  service: ShareService,
  sessions: FamilySessionOperations,
) {
  const r = Router(),
    c = createShareController(service)
  r.use(createRequireAuth(sessions))
  r.get('/', c.owner)
  r.get('/received', c.received)
  r.post('/', c.create)
  r.delete('/:id', c.revoke)
  return r
}
export default createShareRouter(
  new ShareService(new SupabaseShareRepository()),
  new FamilySessionService(new SupabaseAuthSessionRepository()),
)
