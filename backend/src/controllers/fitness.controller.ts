import type { Request, Response, NextFunction } from 'express'
import type { FitnessService } from '../services/fitness.service.js'
export function createFitnessController(service: FitnessService) {
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
      res.json({ fitness: await service.read(req.auth!.profile) })
    }),
    save: handle(async (req, res) => {
      await service.save(
        req.auth!.profile,
        req.params.kind,
        req.params.id ?? null,
        req.body,
      )
      res.sendStatus(204)
    }),
    remove: handle(async (req, res) => {
      await service.remove(req.auth!.profile, req.params.kind, req.params.id)
      res.sendStatus(204)
    }),
  }
}
