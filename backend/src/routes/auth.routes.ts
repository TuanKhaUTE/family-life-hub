import { Router } from 'express'

import {
  createAuthController,
  type FamilyAuthOperations,
} from '../controllers/auth.controller.js'
import { createRequireAuth } from '../middleware/require-auth.js'
import { SupabaseAuthSessionRepository } from '../repositories/auth-session.repository.js'
import { SupabaseFamilyAuthRepository } from '../repositories/family-auth.repository.js'
import { FamilyAuthService } from '../services/family-auth.service.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../services/family-session.service.js'

export function createAuthRouter(
  service: FamilyAuthOperations,
  sessionService: FamilySessionOperations,
): Router {
  const authRouter = Router()
  const controller = createAuthController(service, sessionService)

  authRouter.get('/profiles', controller.getProfiles)
  authRouter.post('/login', controller.login)
  authRouter.get('/me', createRequireAuth(sessionService), controller.getMe)
  authRouter.post('/logout', controller.logout)

  return authRouter
}

const sessionRepository = new SupabaseAuthSessionRepository()
const sessionService = new FamilySessionService(sessionRepository)
const authService = new FamilyAuthService(
  new SupabaseFamilyAuthRepository(),
  sessionService,
)

export default createAuthRouter(authService, sessionService)
