import type { Request, Response, NextFunction } from 'express'
import type { FamilyFoodService } from '../services/family-food.service.js'
export function createFamilyFoodController(service: FamilyFoodService) {
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
    read: handle(async (req, res) => {
      res.json({
        familyFood: await service.read(
          req.auth!.profile,
          req.query.month,
          req.query.page,
        ),
      })
    }),
    summary: handle(async (req, res) => {
      res.json({ summary: await service.summary(req.auth!.profile, req.query.month) })
    }),
    slot: handle(async (req, res) => {
      res.json({
        expense: await service.slot(
          req.auth!.profile,
          req.query.mealDate,
          req.query.mealType,
        ),
      })
    }),
    prefill: handle(async (req, res) => {
      res.json({
        names: await service.prefill(
          req.auth!.profile,
          req.query.mealDate,
          req.query.mealType,
        ),
      })
    }),
    save: handle(async (req, res) => {
      await service.save(req.auth!.profile, req.params.id ?? null, req.body)
      res.sendStatus(204)
    }),
    remove: handle(async (req, res) => {
      await service.remove(req.auth!.profile, req.params.id)
      res.sendStatus(204)
    }),
  }
}
