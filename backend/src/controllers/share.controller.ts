import type { Request, Response, NextFunction } from 'express'
import type { ShareService } from '../services/share.service.js'
export function createShareController(service: ShareService) {
  const handle =
    (op: (req: Request, res: Response) => Promise<void>) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        res.set('Cache-Control', 'no-store')
        await op(req, res)
      } catch (e) {
        next(e)
      }
    }
  return {
    owner: handle(async (req, res) => {
      res.json({
        sharing: await service.owner(
          req.auth!.profile,
          req.query.resourceType,
          req.query.resourceId,
        ),
      })
    }),
    received: handle(async (req, res) => {
      res.json({
        received: await service.received(req.auth!.profile, req.query.page),
      })
    }),
    create: handle(async (req, res) => {
      res
        .status(201)
        .json({ shareId: await service.create(req.auth!.profile, req.body) })
    }),
    revoke: handle(async (req, res) => {
      await service.revoke(req.auth!.profile, req.params.id)
      res.sendStatus(204)
    }),
  }
}
