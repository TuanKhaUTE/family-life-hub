import { Router } from 'express'

import {
  createNotificationController,
  type NotificationOperations,
} from '../controllers/notification.controller.js'
import { createRequireAuth } from '../middleware/require-auth.js'
import { SupabaseAuthSessionRepository } from '../repositories/auth-session.repository.js'
import { SupabaseNotificationRepository } from '../repositories/notification.repository.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../services/family-session.service.js'
import { NotificationService } from '../services/notification.service.js'

export function createNotificationRouter(
  service: NotificationOperations,
  sessionService: FamilySessionOperations,
): Router {
  const router = Router()
  const controller = createNotificationController(service)
  router.use(createRequireAuth(sessionService))
  router.get('/', controller.list)
  router.patch('/:id/read', controller.markRead)
  return router
}

const sessionService = new FamilySessionService(
  new SupabaseAuthSessionRepository(),
)
const notificationService = new NotificationService(
  new SupabaseNotificationRepository(),
)

export default createNotificationRouter(notificationService, sessionService)
