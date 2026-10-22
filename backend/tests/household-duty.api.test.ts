import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import {
  HouseholdDutyService,
  type HouseholdDutyRepository,
} from '../src/services/household-duty.service.js'
import { createHouseholdDutyRouter } from '../src/routes/household-duty.routes.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import type { FamilySessionOperations } from '../src/services/family-session.service.js'
import type { SafeFamilyProfile } from '../src/services/family-auth.service.js'
const profile: SafeFamilyProfile = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Synthetic Duty Member',
  role: 'MEMBER',
  avatarType: null,
  avatarValue: null,
}
function setup(role: SafeFamilyProfile['role'] = 'MEMBER', active = true) {
  const repository: HouseholdDutyRepository = {
    list: vi.fn(async () => ({ members: [], duties: [] })),
    saveWeek: vi.fn(async () => {}),
    duplicateWeek: vi.fn(async () => 0),
    complete: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
  }
  const service = new HouseholdDutyService(
    repository,
    () => new Date('2099-05-04T12:00Z'),
  )
  const sessions = {
    authenticate: async () =>
      active ? { sessionId: 'synthetic', profile: { ...profile, role } } : null,
  } as unknown as FamilySessionOperations
  return {
    repository,
    app: express()
      .use(express.json())
      .use('/api/chores/duties', createHouseholdDutyRouter(service, sessions))
      .use(errorHandler),
  }
}
describe('household duty authenticated REST API', () => {
  it.each(['get', 'save', 'copy', 'complete', 'cancel'])(
    'rejects missing session for %s',
    async (operation) => {
      const { app, repository } = setup('MEMBER', false)
      const call =
        operation === 'get'
          ? request(app).get('/api/chores/duties')
          : operation === 'save'
            ? request(app).put('/api/chores/duties/week')
            : operation === 'copy'
              ? request(app).post('/api/chores/duties/duplicate-week')
              : operation === 'complete'
                ? request(app).post('/api/chores/duties/2099-05-04/complete')
                : request(app).delete('/api/chores/duties/2099-05-04')
      expect((await call).status).toBe(401)
      expect(repository.list).not.toHaveBeenCalled()
      expect(repository.complete).not.toHaveBeenCalled()
    },
  )
  it.each(['ADMIN', 'MEMBER', 'PARENT'] as const)(
    '%s reads safe family duties with no cache',
    async (role) => {
      const { app } = setup(role)
      const response = await request(app).get(
        '/api/chores/duties?from=2099-05-04&to=2099-05-10',
      )
      expect(response.status).toBe(200)
      expect(response.headers['cache-control']).toBe('no-store')
      expect(response.body).toEqual({ household: { members: [], duties: [] } })
    },
  )
  it('parent saves/copies/cancels through explicit routes', async () => {
    const { app, repository } = setup('PARENT')
    expect(
      (
        await request(app)
          .put('/api/chores/duties/week')
          .send({ assignments: [{ date: '2099-05-04', memberId: profile.id }] })
      ).status,
    ).toBe(204)
    expect(
      (
        await request(app)
          .post('/api/chores/duties/duplicate-week')
          .send({ sourceWeek: '2099-05-04' })
      ).body,
    ).toEqual({ copied: 0 })
    expect(
      (await request(app).delete('/api/chores/duties/2099-05-04')).status,
    ).toBe(204)
    expect(repository.cancel).toHaveBeenCalledWith(profile.id, '2099-05-04')
  })
  it('completion uses session identity, ignoring any forged client member identity', async () => {
    const { app, repository } = setup()
    const response = await request(app)
      .post('/api/chores/duties/2099-05-04/complete')
      .send({ memberId: 'foreign', completedAt: 'forged' })
    expect(response.status).toBe(204)
    expect(repository.complete).toHaveBeenCalledWith(profile.id, '2099-05-04')
  })
  it('does not leak storage details in error responses', async () => {
    const { app, repository } = setup()
    vi.mocked(repository.complete).mockRejectedValue(
      new Error('private service key'),
    )
    const response = await request(app).post(
      '/api/chores/duties/2099-05-04/complete',
    )
    expect(response.status).toBe(503)
    expect(JSON.stringify(response.body)).not.toMatch(
      /private|stack|service key/,
    )
  })
})
