import { Router } from 'express'
import { createRequireAuth } from '../middleware/require-auth.js'
import { createPersonalExpenseController } from '../controllers/personal-expense.controller.js'
import { PersonalExpenseService } from '../services/personal-expense.service.js'
import { SupabasePersonalExpenseRepository } from '../repositories/personal-expense.repository.js'
import { SupabaseAuthSessionRepository } from '../repositories/auth-session.repository.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../services/family-session.service.js'

export function createPersonalExpenseRouter(
  service: PersonalExpenseService,
  sessions: FamilySessionOperations,
) {
  const router = Router(),
    c = createPersonalExpenseController(service)
  router.use(createRequireAuth(sessions))
  router.get('/', c.read)
  router.post('/', c.save)
  router.put('/:id', c.save)
  router.delete('/:id', c.remove)
  return router
}
export default createPersonalExpenseRouter(
  new PersonalExpenseService(new SupabasePersonalExpenseRepository()),
  new FamilySessionService(new SupabaseAuthSessionRepository()),
)
