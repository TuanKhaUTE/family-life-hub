import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import {
  ChoreService,
  type ChoreRepository,
} from '../src/services/chore.service.js'
import { createChoreRouter } from '../src/routes/chore.routes.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../src/services/family-session.service.js'
import { ApiError } from '../src/errors/api-error.js'
import type { SafeFamilyProfile } from '../src/services/family-auth.service.js'
const id = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222'
const profile: SafeFamilyProfile = {
  id,
  displayName: 'Synthetic Chore Member',
  role: 'PARENT',
  avatarType: null,
  avatarValue: null,
}
const input = {
  requestId: other,
  title: '  Việc thử nghiệm  ',
  category: 'DISHES',
  scheduledDate: '2099-05-04',
  scheduledTime: null,
  assignedMemberId: other,
  weeklyAssignments: [],
  recurrenceUntil: null,
  note: '  Ghi chú  ',
}
function setup(
  role: SafeFamilyProfile['role'] = 'PARENT',
  authenticated = true,
) {
  const repository: ChoreRepository = {
    list: vi.fn(async () => ({ members: [], chores: [] })),
    save: vi.fn(async () => id),
    cancelSchedule: vi.fn(async () => {}),
    cancelOccurrence: vi.fn(async () => {}),
    complete: vi.fn(async () => {}),
  }
  const service = new ChoreService(
    repository,
    () => new Date('2099-05-04T03:00:00Z'),
  )
  const sessions = authenticated
    ? ({
        authenticate: async () => ({
          sessionId: 'private-session',
          profile: { ...profile, role },
        }),
      } as unknown as FamilySessionOperations)
    : new FamilySessionService({
        createSession: async () => {
          throw new Error()
        },
        findAuthenticatedSession: async () => null,
        deleteByTokenHash: async () => {},
      })
  const app = express()
    .use(express.json())
    .use('/api/chores', createChoreRouter(service, sessions))
    .use(errorHandler)
  return { app, repository, service, actor: { ...profile, role } }
}
describe('family chore API', () => {
  it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
    '%s can read family chores with session-only actor',
    async (role) => {
      const s = setup(role)
      const r = await request(s.app).get(
        '/api/chores?from=2099-05-04&to=2099-05-10',
      )
      expect(r.status).toBe(200)
      expect(r.body.chores).toMatchObject({
        members: [],
        chores: [],
        timeZone: 'Asia/Ho_Chi_Minh',
      })
      expect(s.repository.list).toHaveBeenCalledWith(
        id,
        '2099-05-04',
        '2099-05-10',
        null,
      )
      expect(JSON.stringify(r.body)).not.toMatch(/session|token|pin_hash/)
    },
  )
  it.each(['get', 'create', 'update', 'delete', 'complete', 'cancel'])(
    'requires session for %s',
    async (action) => {
      const { app } = setup('MEMBER', false)
      const r =
        action === 'get'
          ? await request(app).get('/api/chores')
          : action === 'create'
            ? await request(app).post('/api/chores/schedules').send(input)
            : action === 'update'
              ? await request(app)
                  .put(`/api/chores/schedules/${id}`)
                  .send(input)
              : action === 'delete'
                ? await request(app).delete(`/api/chores/schedules/${id}`)
                : await request(app)
                    .post(
                      `/api/chores/schedules/${id}/occurrences/2099-05-04/${action}`,
                    )
                    .send({})
      expect(r.status).toBe(401)
    },
  )
  it.each(['ADMIN', 'MEMBER'] as const)(
    '%s cannot create, reassign or cancel family chores',
    async (role) => {
      const s = setup(role)
      expect(
        (await request(s.app).post('/api/chores/schedules').send(input)).status,
      ).toBe(403)
      expect(
        (await request(s.app).put(`/api/chores/schedules/${id}`).send(input))
          .status,
      ).toBe(403)
      expect(
        (await request(s.app).delete(`/api/chores/schedules/${id}`)).status,
      ).toBe(403)
      expect(
        (
          await request(s.app)
            .post(`/api/chores/schedules/${id}/occurrences/2099-05-04/cancel`)
            .send({})
        ).status,
      ).toBe(403)
      expect(s.repository.save).not.toHaveBeenCalled()
    },
  )
  it('parent creates and edits assignments with a stable retry key', async () => {
    const s = setup()
    expect(
      (await request(s.app).post('/api/chores/schedules').send(input)).body,
    ).toEqual({ scheduleId: id })
    expect(s.repository.save).toHaveBeenCalledWith(id, null, {
      ...input,
      title: 'Việc thử nghiệm',
      note: 'Ghi chú',
    })
    expect(
      (
        await request(s.app)
          .put(`/api/chores/schedules/${id}`)
          .send({ ...input, assignedMemberId: id })
      ).status,
    ).toBe(200)
    expect(s.repository.save).toHaveBeenLastCalledWith(
      id,
      id,
      expect.objectContaining({ assignedMemberId: id }),
    )
    expect(
      (await request(s.app).delete(`/api/chores/schedules/${id}`)).status,
    ).toBe(204)
  })
  it('supports a weekly assignment grid without technical recurrence strings', async () => {
    const s = setup()
    const weekly = {
      ...input,
      assignedMemberId: null,
      weeklyAssignments: [
        { weekday: 1, memberId: other },
        { weekday: 2, memberId: id },
      ],
      recurrenceUntil: '2099-06-01',
    }
    expect(
      (await request(s.app).post('/api/chores/schedules').send(weekly)).status,
    ).toBe(201)
    expect(s.repository.save).toHaveBeenCalledWith(
      id,
      null,
      expect.objectContaining({ weeklyAssignments: weekly.weeklyAssignments }),
    )
  })
  it.each([
    { ...input, title: ' ' },
    { ...input, title: 'a'.repeat(121) },
    { ...input, note: 'a'.repeat(1001) },
    { ...input, category: 'POINTS' },
    { ...input, scheduledDate: '2099-02-30' },
    { ...input, scheduledTime: '25:00' },
    { ...input, scheduledTime: '19:00Z' },
    { ...input, assignedMemberId: 'not-uuid' },
    { ...input, requestId: 'bad' },
    { ...input, assignedMemberId: null },
    { ...input, weeklyAssignments: [{ weekday: 1, memberId: id }] },
    {
      ...input,
      assignedMemberId: null,
      weeklyAssignments: [
        { weekday: 1, memberId: id },
        { weekday: 1, memberId: other },
      ],
    },
    {
      ...input,
      assignedMemberId: null,
      weeklyAssignments: [{ weekday: 8, memberId: id }],
    },
    { ...input, recurrenceUntil: '2099-06-01' },
    { ...input, actorMemberId: other },
    { ...input, status: 'COMPLETED' },
  ])('rejects invalid/unsafe input before storage', async (invalid) => {
    const s = setup()
    await expect(s.service.save(s.actor, null, invalid)).rejects.toMatchObject({
      status: 400,
    })
    expect(s.repository.save).not.toHaveBeenCalled()
  })
  it('completes using the session member, not supplied assignee identity', async () => {
    const s = setup('MEMBER')
    expect(
      (
        await request(s.app)
          .post(
            `/api/chores/schedules/${other}/occurrences/2099-05-04/complete`,
          )
          .send({})
      ).status,
    ).toBe(204)
    expect(s.repository.complete).toHaveBeenCalledWith(id, other, '2099-05-04')
    expect(
      (
        await request(s.app)
          .post(
            `/api/chores/schedules/${other}/occurrences/2099-05-04/complete`,
          )
          .send({ memberId: other })
      ).status,
    ).toBe(400)
  })
  it('rejects future completion without calling storage', async () => {
    const s = setup('MEMBER')
    expect(
      (
        await request(s.app)
          .post(`/api/chores/schedules/${id}/occurrences/2099-05-05/complete`)
          .send({})
      ).status,
    ).toBe(400)
    expect(s.repository.complete).not.toHaveBeenCalled()
  })
  it('preserves database assignee denial and hides unknown storage failures', async () => {
    const s = setup('ADMIN')
    vi.mocked(s.repository.complete).mockRejectedValue(
      new ApiError(403, 'CHORE_FORBIDDEN', 'Chore action is not permitted'),
    )
    expect(
      (
        await request(s.app)
          .post(
            `/api/chores/schedules/${other}/occurrences/2099-05-04/complete`,
          )
          .send({})
      ).status,
    ).toBe(403)
    vi.mocked(s.repository.list).mockRejectedValue(
      new Error('private storage detail'),
    )
    const r = await request(s.app).get('/api/chores')
    expect(r.status).toBe(503)
    expect(JSON.stringify(r.body)).not.toMatch(/private|stack/)
  })
  it.each(['from=2099-02-30', 'from=2099-05-01&to=2099-07-01', 'memberId=bad'])(
    'rejects unsafe range/filter %s',
    async (query) =>
      expect(
        (await request(setup().app).get(`/api/chores?${query}`)).status,
      ).toBe(400),
  )
})
