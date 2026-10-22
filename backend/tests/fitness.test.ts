import request from 'supertest'
import { describe, expect, it } from 'vitest'
import app from '../src/app.js'
import express from 'express'
import { vi } from 'vitest'
import {
  FitnessService,
  type FitnessRepository,
} from '../src/services/fitness.service.js'
import { createFitnessRouter } from '../src/routes/fitness.routes.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import { ApiError } from '../src/errors/api-error.js'
import type { FamilySessionOperations } from '../src/services/family-session.service.js'
import type { SafeFamilyProfile } from '../src/services/family-auth.service.js'
const id = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222'
const inputs = {
  plans: { name: ' Synthetic plan ', note: null, isActive: true },
  days: { planId: id, weekday: 1, title: 'Synthetic day', note: null },
  goals: { weeklySessionTarget: 3, isActive: true },
  sessions: {
    planDayId: null,
    performedAt: '2026-10-22',
    durationMinutes: 60,
    title: 'Synthetic workout',
    note: null,
  },
}
function setup(role: SafeFamilyProfile['role'] = 'MEMBER') {
  const repository: FitnessRepository = {
    read: vi.fn(async () => ({
      plans: [],
      days: [],
      goals: [],
      sessions: [],
      summary: {
        weekStart: '2026-10-19',
        weekEnd: '2026-10-25',
        sessionsThisWeek: 0,
        weeklyTarget: null,
        completionPercent: null,
        totalMinutes: 0,
        unrecordedDurationCount: 0,
        nextWorkout: null,
      },
    })),
    mutate: vi.fn(async () => {}),
  }
  const actor: SafeFamilyProfile = {
    id,
    role,
    displayName: 'Synthetic Fitness',
    avatarType: null,
    avatarValue: null,
  }
  const service = new FitnessService(
    repository,
    () => new Date('2026-10-21T19:00:00Z'),
  )
  const sessions = {
    authenticate: async () => ({
      sessionId: 'private-session',
      profile: actor,
    }),
  } as unknown as FamilySessionOperations
  return {
    repository,
    actor,
    service,
    app: express()
      .use(express.json())
      .use('/api/fitness', createFitnessRouter(service, sessions))
      .use(errorHandler),
  }
}
describe('private Fitness API', () => {
  it('requires a session before exposing Fitness', async () =>
    expect((await request(app).get('/api/fitness')).status).toBe(401))
  it.each(['plans', 'days', 'goals', 'sessions'] as const)(
    'requires auth for %s mutations',
    async (kind) => {
      expect(
        (await request(app).post(`/api/fitness/${kind}`).send(inputs[kind]))
          .status,
      ).toBe(401)
      expect(
        (await request(app).delete(`/api/fitness/${kind}/${id}`)).status,
      ).toBe(401)
    },
  )
  it.each(['ADMIN', 'MEMBER'] as const)(
    '%s reads only the session owner and cannot select a different member via query',
    async (role) => {
      const s = setup(role)
      const r = await request(s.app).get(
        `/api/fitness?ownerMemberId=${other}&role=ADMIN`,
      )
      expect(r.status).toBe(200)
      expect(s.repository.read).toHaveBeenCalledWith(id, '2026-10-22')
      expect(r.headers['cache-control']).toBe('no-store')
      expect(JSON.stringify(r.body)).not.toContain('private-session')
    },
  )
  it.each(['ADMIN', 'MEMBER'] as const)(
    '%s can create/edit/delete all own Fitness kinds',
    async (role) => {
      const s = setup(role)
      for (const kind of ['plans', 'days', 'goals', 'sessions'] as const) {
        expect(
          (await request(s.app).post(`/api/fitness/${kind}`).send(inputs[kind]))
            .status,
        ).toBe(204)
        expect(
          (
            await request(s.app)
              .put(`/api/fitness/${kind}/${other}`)
              .send(inputs[kind])
          ).status,
        ).toBe(204)
        expect(
          (await request(s.app).delete(`/api/fitness/${kind}/${other}`)).status,
        ).toBe(204)
      }
      expect(
        vi.mocked(s.repository.mutate).mock.calls.every((c) => c[0] === id),
      ).toBe(true)
      expect(vi.mocked(s.repository.mutate).mock.calls[0]![3]).toMatchObject({
        name: 'Synthetic plan',
      })
    },
  )
  it.each(['plans', 'days', 'goals', 'sessions'] as const)(
    'PARENT cannot read or mutate %s',
    async (kind) => {
      const s = setup('PARENT')
      expect((await request(s.app).get('/api/fitness')).status).toBe(403)
      expect(
        (await request(s.app).post(`/api/fitness/${kind}`).send(inputs[kind]))
          .status,
      ).toBe(403)
      expect(
        (
          await request(s.app)
            .put(`/api/fitness/${kind}/${id}`)
            .send(inputs[kind])
        ).status,
      ).toBe(403)
      expect(
        (await request(s.app).delete(`/api/fitness/${kind}/${id}`)).status,
      ).toBe(403)
      expect(s.repository.read).not.toHaveBeenCalled()
      expect(s.repository.mutate).not.toHaveBeenCalled()
    },
  )
  it.each([
    ['plans', { ...inputs.plans, name: ' ' }],
    ['plans', { ...inputs.plans, name: 'x'.repeat(121) }],
    ['plans', { ...inputs.plans, note: 'x'.repeat(1001) }],
    ['plans', { ...inputs.plans, isActive: 'true' }],
    ['days', { ...inputs.days, planId: 'bad' }],
    ['days', { ...inputs.days, weekday: 0 }],
    ['days', { ...inputs.days, weekday: 8 }],
    ['days', { ...inputs.days, weekday: 1.5 }],
    ['days', { ...inputs.days, title: ' ' }],
    ['goals', { ...inputs.goals, weeklySessionTarget: 0 }],
    ['goals', { ...inputs.goals, weeklySessionTarget: 22 }],
    ['goals', { ...inputs.goals, weeklySessionTarget: 1.5 }],
    ['sessions', { ...inputs.sessions, performedAt: '2026-10-23' }],
    ['sessions', { ...inputs.sessions, performedAt: '2026-02-30' }],
    ['sessions', { ...inputs.sessions, durationMinutes: 0 }],
    ['sessions', { ...inputs.sessions, durationMinutes: 1441 }],
    ['sessions', { ...inputs.sessions, durationMinutes: 1.5 }],
    ['sessions', { ...inputs.sessions, planDayId: 'bad' }],
    ['sessions', { ...inputs.sessions, title: ' ' }],
    ['sessions', { ...inputs.sessions, ownerMemberId: other }],
    ['sessions', { ...inputs.sessions, sets: 5 }],
  ] as const)(
    'rejects invalid or owner-injected %s input before storage',
    async (kind, input) => {
      const s = setup()
      expect(
        (await request(s.app).post(`/api/fitness/${kind}`).send(input)).status,
      ).toBe(400)
      expect(s.repository.mutate).not.toHaveBeenCalled()
    },
  )
  it('accepts a completed workout without a planned day or duration', async () => {
    const s = setup()
    expect(
      (
        await request(s.app)
          .post('/api/fitness/sessions')
          .send({ ...inputs.sessions, durationMinutes: null })
      ).status,
    ).toBe(204)
    expect(s.repository.mutate).toHaveBeenCalledWith(
      id,
      'sessions',
      null,
      expect.objectContaining({ planDayId: null, durationMinutes: null }),
      false,
    )
  })
  it('returns safe indistinguishable not-found responses for inaccessible IDs', async () => {
    const s = setup('ADMIN')
    vi.mocked(s.repository.mutate).mockRejectedValue(
      new ApiError(404, 'FITNESS_NOT_FOUND', 'Fitness record not found'),
    )
    expect(
      (await request(s.app).delete(`/api/fitness/sessions/${other}`)).status,
    ).toBe(404)
  })
  it('hides unexpected storage errors', async () => {
    const s = setup()
    vi.mocked(s.repository.read).mockRejectedValue(
      new Error('private SQL credentials'),
    )
    const r = await request(s.app).get('/api/fitness')
    expect(r.status).toBe(503)
    expect(JSON.stringify(r.body)).not.toMatch(/SQL|credentials|stack/)
  })
})
