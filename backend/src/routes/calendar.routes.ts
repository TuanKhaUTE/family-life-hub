import { Router } from 'express'
import { createRequireAuth } from '../middleware/require-auth.js'
import { createCalendarController } from '../controllers/calendar.controller.js'
import { CalendarService } from '../services/calendar.service.js'
import { SupabaseCalendarRepository } from '../repositories/calendar.repository.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../services/family-session.service.js'
import { SupabaseAuthSessionRepository } from '../repositories/auth-session.repository.js'
export function createCalendarRouter(
  service: CalendarService,
  sessions: FamilySessionOperations,
) {
  const router = Router()
  router.use(createRequireAuth(sessions))
  const controller = createCalendarController(service)
  router.get('/', controller.list)
  router.post('/events', controller.create)
  router.put('/events/:eventId', controller.update)
  router.delete('/events/:eventId', controller.remove)
  router.put('/events/:eventId/occurrences/:date', controller.exception)
  return router
}
export default createCalendarRouter(
  new CalendarService(new SupabaseCalendarRepository()),
  new FamilySessionService(new SupabaseAuthSessionRepository()),
)
