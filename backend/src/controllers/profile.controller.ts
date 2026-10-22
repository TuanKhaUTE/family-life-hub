import type { Request, Response, NextFunction } from 'express'
import type { ProfileService } from '../services/profile.service.js'
import {
  SESSION_COOKIE_NAME,
  getSessionCookieClearOptions,
} from '../http/session-cookie.js'
export function createProfileController(service: ProfileService) {
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
    summary: handle(async (req, res) => {
      res.json({ settings: service.summary(req.auth!) })
    }),
    update: handle(async (req, res) => {
      res.json({ profile: await service.update(req.auth!, req.body) })
    }),
    members: handle(async (req, res) => {
      res.json({ members: await service.members(req.auth!) })
    }),
    change: handle(async (req, res) => {
      await service.changePin(req.auth!, req.body)
      res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieClearOptions())
      res.sendStatus(204)
    }),
    reset: handle(async (req, res) => {
      await service.resetPin(req.auth!, req.params.memberId, req.body)
      res.sendStatus(204)
    }),
  }
}
