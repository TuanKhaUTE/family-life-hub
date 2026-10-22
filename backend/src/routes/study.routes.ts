import { Router } from 'express'
import { createRequireAuth } from '../middleware/require-auth.js'
import { createStudyController } from '../controllers/study.controller.js'
import { StudyService } from '../services/study.service.js'
import { SupabaseStudyRepository } from '../repositories/study.repository.js'
import { SupabaseAuthSessionRepository } from '../repositories/auth-session.repository.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../services/family-session.service.js'
export function createStudyRouter(
  service: StudyService,
  sessions: FamilySessionOperations,
) {
  const router = Router(),
    c = createStudyController(service)
  router.use(createRequireAuth(sessions))
  router.get('/', c.read)
  router.get('/assessments', c.assessments)
  router.get('/practice', c.practice)
  router.post('/practice', c.savePractice)
  router.put('/practice/:id', c.savePractice)
  router.delete('/practice/:id', c.removePractice)
  router.patch('/practice/courses/:id', c.togglePractice)
  router.post('/:kind', c.save)
  router.put('/:kind/:id', c.save)
  router.delete('/:kind/:id', c.remove)
  return router
}
export default createStudyRouter(
  new StudyService(new SupabaseStudyRepository()),
  new FamilySessionService(new SupabaseAuthSessionRepository()),
)
