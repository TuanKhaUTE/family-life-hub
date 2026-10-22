import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import {
  CalendarService,
  type CalendarRepository,
} from '../src/services/calendar.service.js'
import { createCalendarRouter } from '../src/routes/calendar.routes.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import {
  FamilySessionService,
  type FamilySessionOperations,
} from '../src/services/family-session.service.js'
import type { SafeFamilyProfile } from '../src/services/family-auth.service.js'
import { generateSessionToken } from '../src/security/session-token.js'

const actor: SafeFamilyProfile = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Synthetic Calendar Member',
  role: 'MEMBER',
  avatarType: null,
  avatarValue: null,
}
const eventId = '22222222-2222-4222-8222-222222222222'
const input = {
  title: '  Hoạt động thử nghiệm  ',
  category: 'SCHOOL',
  startsAt: '2099-05-04T02:30:00Z',
  endsAt: '2099-05-04T07:00:00Z',
  note: '  Ghi chú  ',
  weekdays: [1, 2, 3, 4, 5],
  recurrenceUntil: '2099-06-01',
}
function setup(
  role: SafeFamilyProfile['role'] = 'MEMBER',
  authenticated = true,
) {
  const repository: CalendarRepository = {
    list: vi.fn(async () => ({
      members: [
        {
          id: actor.id,
          displayName: actor.displayName,
          avatarType: null,
          avatarValue: null,
        },
      ],
      occurrences: [],
    })),
    save: vi.fn(async () => eventId),
    remove: vi.fn(async () => {}),
    exception: vi.fn(async () => {}),
    duplicateWeek: vi.fn(async () => 2),
  }
  const service = new CalendarService(
    repository,
    () => new Date('2099-05-04T03:00:00Z'),
  )
  const profile = { ...actor, role }
  const sessions = authenticated
    ? ({
        authenticate: async () => ({ sessionId: 'private-session', profile }),
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
    .use('/api/calendar', createCalendarRouter(service, sessions))
    .use(errorHandler)
  return { repository, service, profile, app }
}
describe('calendar API and validation', () => {
  it('rejects a valid-shaped but inactive/expired session before reading calendar data', async () => {
    const { app, repository } = setup('MEMBER', false)
    const result = await request(app)
      .get('/api/calendar')
      .set('Cookie', `family_session=${generateSessionToken()}`)
    expect(result.status).toBe(401)
    expect(repository.list).not.toHaveBeenCalled()
  })
  it.each(['get', 'post', 'put', 'delete', 'exception'])(
    'requires an active session for %s',
    async (method) => {
      const { app } = setup('MEMBER', false)
      const result =
        method === 'get'
          ? await request(app).get('/api/calendar')
          : method === 'post'
            ? await request(app).post('/api/calendar/events').send(input)
            : method === 'delete'
              ? await request(app).delete(`/api/calendar/events/${eventId}`)
              : await request(app)
                  .put(
                    `/api/calendar/events/${eventId}${method === 'exception' ? '/occurrences/2099-05-04' : ''}`,
                  )
                  .send(input)
      expect(result.status).toBe(401)
    },
  )
  it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
    '%s can read family calendars with safe profile shape',
    async (role) => {
      const { app, repository } = setup(role)
      const result = await request(app).get(
        '/api/calendar?from=2099-05-04&to=2099-05-10',
      )
      expect(result.status).toBe(200)
      expect(result.body.calendar.members[0].displayName).toBe(
        actor.displayName,
      )
      expect(JSON.stringify(result.body)).not.toMatch(
        /session|pin_hash|token|credentials/,
      )
      expect(repository.list).toHaveBeenCalledWith(
        actor.id,
        '2099-05-04',
        '2099-05-10',
        null,
        'FAMILY',
      )
    },
  )
  it('filters by member without treating filter identity as write authority', async () => {
    const { app, repository } = setup()
    expect(
      (await request(app).get(`/api/calendar?memberId=${eventId}`)).status,
    ).toBe(200)
    expect(repository.list).toHaveBeenCalledWith(
      actor.id,
      '2099-05-04',
      '2099-05-04',
      eventId,
      'FAMILY',
    )
    expect(
      (
        await request(app)
          .post('/api/calendar/events')
          .send({ ...input, ownerMemberId: eventId })
      ).status,
    ).toBe(400)
  })
  it('creates a trimmed weekly event using only session ownership', async () => {
    const { app, repository } = setup()
    const result = await request(app).post('/api/calendar/events').send(input)
    expect(result.status).toBe(201)
    expect(result.body).toEqual({ eventId })
    expect(repository.save).toHaveBeenCalledWith(actor.id, null, {
      ...input,
      title: 'Hoạt động thử nghiệm',
      note: 'Ghi chú',
    })
  })
  it('updates an event and deletes through owner-checked repository operations', async () => {
    const { app, repository } = setup()
    expect(
      (await request(app).put(`/api/calendar/events/${eventId}`).send(input))
        .status,
    ).toBe(200)
    expect(repository.save).toHaveBeenCalledWith(
      actor.id,
      eventId,
      expect.objectContaining({ title: 'Hoạt động thử nghiệm' }),
    )
    expect(
      (await request(app).delete(`/api/calendar/events/${eventId}`)).status,
    ).toBe(204)
    expect(repository.remove).toHaveBeenCalledWith(actor.id, eventId)
  })
  it.each([
    { ...input, title: ' ' },
    { ...input, title: 'a'.repeat(121) },
    { ...input, note: 'a'.repeat(1001) },
    { ...input, category: 'UNKNOWN' },
    { ...input, endsAt: input.startsAt },
    { ...input, startsAt: '2099-05-04T09:30' },
    { ...input, weekdays: [] },
    { ...input, weekdays: [1, 1] },
    { ...input, weekdays: [8] },
    { ...input, recurrenceUntil: '2099-02-30' },
    { ...input, recurrenceUntil: '2099-05-01' },
    { ...input, weekdays: null, recurrenceUntil: '2099-06-01' },
    { ...input, endsAt: '2099-05-05T07:00:00Z' },
    { ...input, actorMemberId: eventId },
  ])('rejects invalid input without accessing storage', async (invalid) => {
    const { service, profile, repository } = setup()
    await expect(service.save(profile, null, invalid)).rejects.toMatchObject({
      status: 400,
    })
    expect(repository.save).not.toHaveBeenCalled()
  })
  it.each([
    'from=2099-02-30',
    'from=2099-06-01&to=2099-05-01',
    'from=2099-05-01&to=2099-07-01',
    'memberId=not-a-uuid',
  ])('rejects invalid range/filter %s', async (query) => {
    expect(
      (await request(setup().app).get(`/api/calendar?${query}`)).status,
    ).toBe(400)
  })
  it('saves an occurrence cancellation separately from the series', async () => {
    const { app, repository } = setup()
    expect(
      (
        await request(app)
          .put(`/api/calendar/events/${eventId}/occurrences/2099-05-04`)
          .send({ cancelled: true })
      ).status,
    ).toBe(204)
    expect(repository.exception).toHaveBeenCalledWith(
      actor.id,
      eventId,
      '2099-05-04',
      {
        cancelled: true,
        title: null,
        startsAt: null,
        endsAt: null,
        note: null,
      },
    )
    expect(repository.save).not.toHaveBeenCalled()
  })
  it('saves a moved occurrence with its original date identity', async () => {
    const { app, repository } = setup()
    const override = {
      cancelled: false,
      title: 'Buổi học chuyển ngày',
      startsAt: '2099-05-05T02:00:00Z',
      endsAt: '2099-05-05T04:00:00Z',
      note: null,
    }
    expect(
      (
        await request(app)
          .put(`/api/calendar/events/${eventId}/occurrences/2099-05-04`)
          .send(override)
      ).status,
    ).toBe(204)
    expect(repository.exception).toHaveBeenCalledWith(
      actor.id,
      eventId,
      '2099-05-04',
      override,
    )
  })
  it.each([
    { cancelled: true, title: 'unexpected' },
    { cancelled: false },
    {
      cancelled: false,
      title: 'test',
      startsAt: input.endsAt,
      endsAt: input.startsAt,
      note: null,
    },
  ])('rejects invalid exception combinations', async (body) => {
    expect(
      (
        await request(setup().app)
          .put(`/api/calendar/events/${eventId}/occurrences/2099-05-04`)
          .send(body)
      ).status,
    ).toBe(400)
  })
  it('hides storage errors from clients', async () => {
    const { app, repository } = setup()
    vi.mocked(repository.list).mockRejectedValue(
      new Error('private database secret'),
    )
    const result = await request(app).get('/api/calendar')
    expect(result.status).toBe(503)
    expect(result.body.error.code).toBe('CALENDAR_UNAVAILABLE')
    expect(JSON.stringify(result.body)).not.toMatch(/private|secret|stack/)
  })
})

describe('calendar visibility and week copy', () => {
  it.each(['ADMIN', 'MEMBER', 'PARENT'] as const)(
    '%s copies only session-owned family week',
    async (role) => {
      const { app, repository } = setup(role)
      const response = await request(app)
        .post('/api/calendar/duplicate-week')
        .send({ sourceWeek: '2099-05-04' })
      expect(response.status).toBe(200)
      expect(response.body).toEqual({ copied: 2 })
      expect(repository.duplicateWeek).toHaveBeenCalledWith(
        actor.id,
        '2099-05-04',
      )
    },
  )
  it.each(['ADMIN', 'MEMBER'] as const)(
    '%s reads only own personal calendar',
    async (role) => {
      const { app, repository } = setup(role)
      expect(
        (await request(app).get('/api/calendar?calendarType=PERSONAL')).status,
      ).toBe(200)
      expect(repository.list).toHaveBeenCalledWith(
        actor.id,
        '2099-05-04',
        '2099-05-04',
        actor.id,
        'PERSONAL',
      )
      expect(
        (
          await request(app).get(
            `/api/calendar?calendarType=PERSONAL&memberId=${eventId}`,
          )
        ).status,
      ).toBe(403)
    },
  )
  it('does not offer a personal calendar to a parent', async () => {
    const { app, repository } = setup('PARENT')
    expect(
      (await request(app).get('/api/calendar?calendarType=PERSONAL')).status,
    ).toBe(403)
    expect(
      (
        await request(app)
          .post('/api/calendar/events')
          .send({ ...input, calendarType: 'PERSONAL' })
      ).status,
    ).toBe(403)
    expect(repository.list).not.toHaveBeenCalled()
    expect(repository.save).not.toHaveBeenCalled()
  })
  it('rejects invalid visibility and malformed copy requests', async () => {
    const { app } = setup()
    expect(
      (await request(app).get('/api/calendar?calendarType=ALL')).status,
    ).toBe(400)
    expect(
      (
        await request(app)
          .post('/api/calendar/duplicate-week')
          .send({ sourceWeek: '2099-05-05' })
      ).status,
    ).toBe(400)
    expect(
      (
        await request(app)
          .post('/api/calendar/duplicate-week')
          .send({ sourceWeek: '2099-05-04', ownerMemberId: eventId })
      ).status,
    ).toBe(400)
  })
})
