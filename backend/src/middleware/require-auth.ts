import type { NextFunction, Request, Response } from 'express'

import { ApiError } from '../errors/api-error.js'
import { parseSessionCookie } from '../http/session-cookie.js'
import {
  SessionUnavailableError,
  UnauthenticatedError,
  type FamilySessionOperations,
} from '../services/family-session.service.js'

export function createRequireAuth(service: FamilySessionOperations) {
  return async function requireAuth(
    request: Request,
    _response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      request.auth = await service.authenticate(
        parseSessionCookie(request.headers.cookie),
      )
      next()
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        next(new ApiError(401, 'UNAUTHENTICATED', error.message))
        return
      }

      if (error instanceof SessionUnavailableError) {
        next(new ApiError(503, 'AUTH_UNAVAILABLE', error.message))
        return
      }

      next(error)
    }
  }
}
