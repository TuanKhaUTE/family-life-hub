import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../errors/api-error.js'
import type { ActivityPlanService } from '../services/activity-plan.service.js'
export function createActivityPlanController(service: ActivityPlanService) {
  const handler = (action: (req: Request, res: Response) => Promise<void>) => async (req: Request, res: Response, next: NextFunction) => {
    try { if (!req.auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required'); res.set('Cache-Control', 'no-store'); await action(req, res) } catch (error) { next(error) }
  }
  return {
    read: handler(async (req, res) => { res.json({ activities: await service.read(req.auth!.profile, req.query.kind, req.query.id ?? null) }) }),
    save: handler(async (req, res) => { res.json({ id: await service.save(req.auth!.profile, req.query.kind, req.params.id ?? null, req.body) }) }),
    complete: handler(async (req, res) => { await service.complete(req.auth!.profile, req.params.id, req.body, req.method === 'PATCH'); res.sendStatus(204) }),
    cancel: handler(async (req, res) => { await service.cancel(req.auth!.profile, req.params.id); res.sendStatus(204) }),
  }
}
