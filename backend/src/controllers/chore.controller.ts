import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../errors/api-error.js'
import type { ChoreService } from '../services/chore.service.js'
export function createChoreController(service: ChoreService) {
  const handler =
    (action: (req: Request, res: Response) => Promise<void>) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth)
          throw new ApiError(
            401,
            'UNAUTHENTICATED',
            'Authentication is required',
          )
        res.set('Cache-Control', 'no-store')
        await action(req, res)
      } catch (error) {
        next(error)
      }
    }
  return {
    list: handler(async (req, res) => {
      res.json({
        chores: await service.list(
          req.auth!.profile,
          req.query.from,
          req.query.to,
          req.query.memberId,
        ),
      })
    }),
    create: handler(async (req, res) => {
      res
        .status(201)
        .json({
          scheduleId: await service.save(req.auth!.profile, null, req.body),
        })
    }),
    update: handler(async (req, res) => {
      res.json({
        scheduleId: await service.save(
          req.auth!.profile,
          req.params.id,
          req.body,
        ),
      })
    }),
    cancel: handler(async (req, res) => {
      await service.cancelSchedule(req.auth!.profile, req.params.id)
      res.sendStatus(204)
    }),
    complete: handler(async (req, res) => {
      await service.occurrence(
        req.auth!.profile,
        req.params.id,
        req.params.date,
        'complete',
        req.body,
      )
      res.sendStatus(204)
    }),
    cancelOccurrence: handler(async (req, res) => {
      await service.occurrence(
        req.auth!.profile,
        req.params.id,
        req.params.date,
        'cancel',
        req.body,
      )
      res.sendStatus(204)
    }),
  }
}
