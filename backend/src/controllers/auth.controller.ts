import type { NextFunction, Request, Response } from 'express'

import { ApiError } from '../errors/api-error.js'
import {
  AuthUnavailableError,
  AuthValidationError,
  InvalidCredentialsError,
  type SafeFamilyProfile,
} from '../services/family-auth.service.js'

export interface FamilyAuthOperations {
  listProfiles(): Promise<SafeFamilyProfile[]>
  login(input: unknown): Promise<SafeFamilyProfile>
}

export function createAuthController(service: FamilyAuthOperations) {
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
        const profile = await service.login(request.body)
        response.status(200).json({ profile })
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

  if (error instanceof AuthUnavailableError) {
    return new ApiError(503, 'AUTH_UNAVAILABLE', error.message)
  }

  return error
}
