import { Router } from 'express'

import {
  createAuthController,
  type FamilyAuthOperations,
} from '../controllers/auth.controller.js'
import { SupabaseFamilyAuthRepository } from '../repositories/family-auth.repository.js'
import { FamilyAuthService } from '../services/family-auth.service.js'

export function createAuthRouter(service: FamilyAuthOperations): Router {
  const authRouter = Router()
  const controller = createAuthController(service)

  authRouter.get('/profiles', controller.getProfiles)
  authRouter.post('/login', controller.login)

  return authRouter
}

const authService = new FamilyAuthService(new SupabaseFamilyAuthRepository())

export default createAuthRouter(authService)
