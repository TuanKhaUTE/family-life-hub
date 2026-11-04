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
    avatar: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const url = await service.publicAvatar(req.params.memberId)
        res.set('Cache-Control', 'public, max-age=31536000, immutable')
        const version =
          typeof req.query.v === 'string' && req.query.v.length > 0
            ? req.query.v
            : null
        res.redirect(version ? withCacheVersion(url, version) : url)
      } catch (e) {
        next(e)
      }
    },
    summary: handle(async (req, res) => {
      res.json({ settings: service.summary(req.auth!) })
    }),
    update: handle(async (req, res) => {
      res.json({ profile: await service.update(req.auth!, req.body) })
    }),
    uploadAvatar: handle(async (req, res) => {
      res.json({
        profile: await service.uploadAvatar(
          req.auth!,
          req.body,
          req.get('content-type'),
        ),
      })
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

function withCacheVersion(url: string, version: string) {
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`
}
