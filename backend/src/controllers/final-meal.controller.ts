import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../errors/api-error.js'
import {
  FinalMealError,
  type FinalMealService,
} from '../services/final-meal.service.js'

export type FinalMealOperations = Pick<
  FinalMealService,
  'get' | 'save' | 'ready'
>
export function createFinalMealController(service: FinalMealOperations) {
  function handler(action: (request: Request) => Promise<unknown>) {
    return async (request: Request, response: Response, next: NextFunction) => {
      if (!request.auth) {
        next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required'))
        return
      }
      try {
        response.status(200).json({ meal: await action(request) })
      } catch (error) {
        next(
          error instanceof FinalMealError
            ? new ApiError(error.status, error.code, error.message)
            : error,
        )
      }
    }
  }
  return {
    get: handler((req) => service.get(req.params.date, req.params.type)),
    save: handler((req) =>
      service.save(
        req.auth!.profile,
        req.params.date,
        req.params.type,
        req.body,
      ),
    ),
    ready: handler((req) =>
      service.ready(
        req.auth!.profile,
        req.params.date,
        req.params.type,
        req.body,
      ),
    ),
  }
}
