import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../errors/api-error.js'
import type { CalendarService } from '../services/calendar.service.js'

export function createCalendarController(service: CalendarService) {
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
        calendar: await service.list(
          req.auth!.profile,
          req.query.from,
          req.query.to,
          req.query.memberId,
          req.query.calendarType,
        ),
      })
    }),
    duplicateWeek: handler(async (req, res) => {
      res.json({
        copied: await service.duplicateWeek(req.auth!.profile, req.body),
      })
    }),
    create: handler(async (req, res) => {
      res.status(201).json({
        eventId: await service.save(req.auth!.profile, null, req.body),
      })
    }),
    update: handler(async (req, res) => {
      res.json({
        eventId: await service.save(
          req.auth!.profile,
          req.params.eventId,
          req.body,
        ),
      })
    }),
    remove: handler(async (req, res) => {
      await service.remove(req.auth!.profile, req.params.eventId)
      res.sendStatus(204)
    }),
    exception: handler(async (req, res) => {
      await service.exception(
        req.auth!.profile,
        req.params.eventId,
        req.params.date,
        req.body,
      )
      res.sendStatus(204)
    }),
  }
}
