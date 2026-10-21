import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../errors/api-error.js'
import type { DishRatingService } from '../services/dish-rating.service.js'

export function createDishRatingController(service: DishRatingService) {
  function handler(key: string, action: (request: Request) => unknown) {
    return async (request: Request, response: Response, next: NextFunction) => {
      if (!request.auth) {
        next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required'))
        return
      }
      try {
        response.json({ [key]: await action(request) })
      } catch (error) {
        next(error)
      }
    }
  }
  return {
    get: handler('feedback', (request) =>
      service.get(request.auth!.profile, request.params.mealId),
    ),
    save: handler('rating', (request) =>
      service.save(request.auth!.profile, request.params.dishId, request.body),
    ),
  }
}
