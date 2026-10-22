import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../errors/api-error.js'
import type { HouseholdDutyService } from '../services/household-duty.service.js'

export function createHouseholdDutyController(service: HouseholdDutyService) {
  const handler =
    (action: (req: Request, res: Response) => Promise<void>) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth)
          throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required')
        res.set('Cache-Control', 'no-store')
        await action(req, res)
      } catch (error) {
        next(error)
      }
    }
  return {
    list: handler(async (req, res) => {
      res.json({
        household: await service.list(
          req.auth!.profile,
          req.query.from,
          req.query.to,
        ),
      })
    }),
    save: handler(async (req, res) => {
      await service.saveWeek(req.auth!.profile, req.body)
      res.sendStatus(204)
    }),
    duplicate: handler(async (req, res) => {
      res.json({
        copied: await service.duplicateWeek(req.auth!.profile, req.body),
      })
    }),
    complete: handler(async (req, res) => {
      await service.complete(req.auth!.profile, req.params.date)
      res.sendStatus(204)
    }),
    cancel: handler(async (req, res) => {
      await service.cancel(req.auth!.profile, req.params.date)
      res.sendStatus(204)
    }),
  }
}
