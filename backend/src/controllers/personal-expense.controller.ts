import type { Request, Response, NextFunction } from 'express'
import type { PersonalExpenseService } from '../services/personal-expense.service.js'

export function createPersonalExpenseController(
  service: PersonalExpenseService,
) {
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
      res.json({
        personalExpenses: await service.read(
          req.auth!.profile,
          req.query.month,
          req.query.page,
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
