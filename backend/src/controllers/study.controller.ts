import type { Request, Response, NextFunction } from 'express'
import type { StudyService } from '../services/study.service.js'
export function createStudyController(service: StudyService) {
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
    assessments: handle(async (req, res) => {
      res.json({
        grades: await service.assessments(
          req.auth!.profile,
          req.query.courseId,
        ),
      })
    }),
    read: handle(async (req, res) => {
      res.json({ study: await service.read(req.auth!.profile) })
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
    practice: handle(async (req, res) => {
      res.json({ practice: await service.practice(req.auth!.profile, req.query.courseId) })
    }),
    savePractice: handle(async (req, res) => {
      await service.savePractice(req.auth!.profile, req.params.id ?? null, req.body)
      res.sendStatus(204)
    }),
    removePractice: handle(async (req, res) => {
      await service.removePractice(req.auth!.profile, req.params.id)
      res.sendStatus(204)
    }),
    togglePractice: handle(async (req, res) => {
      await service.togglePractice(req.auth!.profile, req.params.id, req.body?.enabled)
      res.sendStatus(204)
    }),
  }
}
