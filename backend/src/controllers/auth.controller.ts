import type { NextFunction, Request, Response } from 'express'

import { ApiError } from '../errors/api-error.js'
import {
  getSessionCookieClearOptions,
  getSessionCookieOptions,
  parseSessionCookie,
  SESSION_COOKIE_NAME,
} from '../http/session-cookie.js'
import {
  AuthUnavailableError,
  AuthValidationError,
  InvalidCredentialsError,
  type SafeFamilyProfile,
  type SuccessfulFamilyLogin,
} from '../services/family-auth.service.js'
import {
  SessionUnavailableError,
  type FamilySessionOperations,
} from '../services/family-session.service.js'

export interface FamilyAuthOperations {
  listProfiles(): Promise<SafeFamilyProfile[]>
  login(input: unknown): Promise<SuccessfulFamilyLogin>
}

export function createAuthController(
  service: FamilyAuthOperations,
  sessionService: FamilySessionOperations,
) {
  return {
    async getProfiles(
      _request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const profiles = await service.listProfiles()
        response.status(200).json({ profiles })
      } catch (error) {
        next(toAuthApiError(error))
      }
    },

    async login(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        const result = await service.login(request.body)
        response.cookie(
          SESSION_COOKIE_NAME,
          result.session.token,
          getSessionCookieOptions(result.session.expiresAt),
        )
        response.status(200).json({ profile: result.profile })
      } catch (error) {
        next(toAuthApiError(error))
      }
    },

    getMe(request: Request, response: Response, next: NextFunction): void {
      if (!request.auth) {
        next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required'))
        return
      }

      response.status(200).json({ profile: request.auth.profile })
    },

    async logout(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      response.clearCookie(
        SESSION_COOKIE_NAME,
        getSessionCookieClearOptions(),
      )

      try {
        await sessionService.logout(parseSessionCookie(request.headers.cookie))
        response.status(204).send()
      } catch (error) {
        next(toAuthApiError(error))
      }
    },
  }
}

function toAuthApiError(error: unknown): unknown {
  if (error instanceof AuthValidationError) {
    return new ApiError(400, 'VALIDATION_ERROR', error.message)
  }

  if (error instanceof InvalidCredentialsError) {
    return new ApiError(401, 'INVALID_CREDENTIALS', error.message)
  }

  if (
    error instanceof AuthUnavailableError ||
    error instanceof SessionUnavailableError
  ) {
    return new ApiError(503, 'AUTH_UNAVAILABLE', error.message)
  }

  return error
}
