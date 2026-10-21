import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../errors/api-error.js'
import type { HomeService } from '../services/home.service.js'

export function createHomeController(service: HomeService) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      if (!request.auth)
        throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required')
      response.set('Cache-Control', 'no-store')
      response.json({ home: await service.get(request.auth.profile) })
    } catch (error) {
      next(error)
    }
  }
}
