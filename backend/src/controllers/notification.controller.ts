import type { NextFunction, Request, Response } from 'express'

import { ApiError } from '../errors/api-error.js'
import {
  NotificationNotFoundError,
  NotificationUnavailableError,
  NotificationValidationError,
  type AppNotification,
} from '../services/notification.service.js'

export interface NotificationOperations {
  list(recipientMemberId: string): Promise<AppNotification[]>
  markRead(
    recipientMemberId: string,
    notificationId: unknown,
  ): Promise<AppNotification>
}

export function createNotificationController(service: NotificationOperations) {
  return {
    async list(request: Request, response: Response, next: NextFunction): Promise<void> {
      if (!request.auth) {
        next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required'))
        return
      }
      try {
        response.status(200).json({
          notifications: await service.list(request.auth.profile.id),
        })
      } catch (error) {
        next(toApiError(error))
      }
    },

    async markRead(request: Request, response: Response, next: NextFunction): Promise<void> {
      if (!request.auth) {
        next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required'))
        return
      }
      try {
        response.status(200).json({
          notification: await service.markRead(
            request.auth.profile.id,
            request.params.id,
          ),
        })
      } catch (error) {
        next(toApiError(error))
      }
    },
  }
}

function toApiError(error: unknown): unknown {
  if (error instanceof NotificationValidationError) {
    return new ApiError(400, 'VALIDATION_ERROR', error.message)
  }
  if (error instanceof NotificationNotFoundError) {
    return new ApiError(404, 'NOTIFICATION_NOT_FOUND', error.message)
  }
  if (error instanceof NotificationUnavailableError) {
    return new ApiError(503, 'NOTIFICATION_UNAVAILABLE', error.message)
  }
  return error
}
