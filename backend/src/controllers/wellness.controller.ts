import type { Request, Response, NextFunction } from 'express'
import type { WellnessService } from '../services/wellness.service.js'

export function createWellnessController(service: WellnessService) {
  const handle =
    (action: (req: Request, res: Response) => Promise<void>) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        res.set('Cache-Control', 'no-store')
        await action(req, res)
      } catch (error) {
        next(error)
      }
    }
  return {
    read: handle(async (req, res) => {
      res.json({ wellness: await service.read(req.auth!.profile) })
    }),
    saveProfile: handle(async (req, res) => {
      await service.save(req.auth!.profile, 'profile', null, req.body)
      res.sendStatus(204)
    }),
    removeProfile: handle(async (req, res) => {
      await service.remove(req.auth!.profile, 'profile', null)
      res.sendStatus(204)
    }),
    saveLog: handle(async (req, res) => {
      await service.save(
        req.auth!.profile,
        'logs',
        (req.params.id as string) ?? null,
        req.body,
      )
      res.sendStatus(204)
    }),
    removeLog: handle(async (req, res) => {
      await service.remove(req.auth!.profile, 'logs', req.params.id as string)
      res.sendStatus(204)
    }),
  }
}
