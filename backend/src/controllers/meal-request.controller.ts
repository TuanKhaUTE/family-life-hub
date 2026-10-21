import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../errors/api-error.js'
import {
  MealRequestClosedError,
  MealRequestConflictError,
  MealRequestForbiddenError,
  MealRequestNotFoundError,
  MealRequestUnavailableError,
  MealRequestValidationError,
  type MealRequestService,
} from '../services/meal-request.service.js'

export type MealRequestOperations = Pick<
  MealRequestService,
  'listCurrent' | 'create' | 'update' | 'saveResponse'
>

export function createMealRequestController(service: MealRequestOperations) {
  return {
    listCurrent: handler(async (request, response) =>
      response
        .status(200)
        .json({ requests: await service.listCurrent(request.auth!.profile) }),
    ),
    create: handler(async (request, response) =>
      response.status(201).json({
        request: await service.create(request.auth!.profile, request.body),
      }),
    ),
    update: handler(async (request, response) =>
      response.status(200).json({
        request: await service.update(
          request.auth!.profile,
          request.params.id,
          request.body,
        ),
      }),
    ),
    saveResponse: handler(async (request, response) =>
      response.status(200).json({
        response: await service.saveResponse(
          request.auth!.profile,
          request.params.id,
          request.body,
        ),
      }),
    ),
  }
}

function handler(
  action: (request: Request, response: Response) => Promise<Response>,
) {
  return async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!request.auth) {
      next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required'))
      return
    }
    try {
      await action(request, response)
    } catch (error) {
      next(toApiError(error))
    }
  }
}

function toApiError(error: unknown): unknown {
  if (error instanceof MealRequestValidationError)
    return new ApiError(400, 'VALIDATION_ERROR', error.message)
  if (error instanceof MealRequestForbiddenError)
    return new ApiError(403, 'MEAL_FORBIDDEN', error.message)
  if (error instanceof MealRequestNotFoundError)
    return new ApiError(404, 'MEAL_NOT_FOUND', error.message)
  if (error instanceof MealRequestClosedError)
    return new ApiError(409, 'MEAL_CLOSED', error.message)
  if (error instanceof MealRequestConflictError)
    return new ApiError(409, 'MEAL_CONFLICT', error.message)
  if (error instanceof MealRequestUnavailableError)
    return new ApiError(503, 'MEAL_UNAVAILABLE', error.message)
  return error
}
