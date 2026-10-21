import type { NextFunction, Request, Response } from 'express'

import { ApiError } from '../errors/api-error.js'
import {
  BreakfastClosedError,
  BreakfastForbiddenError,
  BreakfastUnavailableError,
  BreakfastValidationError,
  type BreakfastCatalogItem,
  type BreakfastDay,
  type BreakfastDayResponse,
} from '../services/breakfast.service.js'
import type { SafeFamilyProfile } from '../services/family-auth.service.js'

export interface BreakfastOperations {
  getCatalog(): Promise<BreakfastCatalogItem[]>
  getDay(
    profile: SafeFamilyProfile,
    requestedDate: unknown,
  ): Promise<BreakfastDay>
  saveResponse(
    profile: SafeFamilyProfile,
    requestedDate: unknown,
    input: unknown,
  ): Promise<BreakfastDayResponse>
}

export function createBreakfastController(service: BreakfastOperations) {
  return {
    async getCatalog(
      _request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      try {
        response.status(200).json({ items: await service.getCatalog() })
      } catch (error) {
        next(toBreakfastApiError(error))
      }
    },

    async getDay(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      if (!request.auth) {
        next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required'))
        return
      }

      try {
        const day = await service.getDay(request.auth.profile, request.params.date)
        response.status(200).json({ day })
      } catch (error) {
        next(toBreakfastApiError(error))
      }
    },

    async saveResponse(
      request: Request,
      response: Response,
      next: NextFunction,
    ): Promise<void> {
      if (!request.auth) {
        next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required'))
        return
      }

      try {
        const savedResponse = await service.saveResponse(
          request.auth.profile,
          request.params.date,
          request.body,
        )
        response.status(200).json({ response: savedResponse })
      } catch (error) {
        next(toBreakfastApiError(error))
      }
    },
  }
}

function toBreakfastApiError(error: unknown): unknown {
  if (error instanceof BreakfastValidationError) {
    return new ApiError(400, 'VALIDATION_ERROR', error.message)
  }

  if (error instanceof BreakfastForbiddenError) {
    return new ApiError(403, 'BREAKFAST_FORBIDDEN', error.message)
  }

  if (error instanceof BreakfastClosedError) {
    return new ApiError(409, 'BREAKFAST_CLOSED', error.message)
  }

  if (error instanceof BreakfastUnavailableError) {
    return new ApiError(503, 'BREAKFAST_UNAVAILABLE', error.message)
  }

  return error
}
