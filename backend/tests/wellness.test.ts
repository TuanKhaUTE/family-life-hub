import request from 'supertest'
import { expect, it, vi } from 'vitest'
import app from '../src/app.js'
import express from 'express'
import {
  WellnessService,
  calculateWellness,
  type WellnessRepository,
  type WeightLog,
} from '../src/services/wellness.service.js'
import { createWellnessRouter } from '../src/routes/wellness.routes.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import type { FamilySessionOperations } from '../src/services/family-session.service.js'
import type { SafeFamilyProfile } from '../src/services/family-auth.service.js'

const id = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const profile = { heightCm: 174, targetWeightKg: 64, activityLevel: null }
function log(date: string, weight: number): WeightLog {
  return { id, loggedDate: date, weightKg: weight, note: null }
}
function setup(role: SafeFamilyProfile['role'] = 'MEMBER') {
  const repository: WellnessRepository = {
    read: vi.fn(async () => ({
      profile,
      logs: [log('2026-10-22', 62.5), log('2026-10-15', 62)],
    })),
    mutate: vi.fn(async () => {}),
  }
  const actor: SafeFamilyProfile = {
    id,
    role,
    displayName: 'Synthetic Wellness',
    avatarType: null,
    avatarValue: null,
  }
  const service = new WellnessService(
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
    actor,
    repository,
    service,
    app: express()
      .use(express.json())
      .use('/api/wellness', createWellnessRouter(service, sessions))
      .use(errorHandler),
  }
}

it('requires an authenticated session before exposing Wellness', async () => {
  expect((await request(app).get('/api/wellness')).status).toBe(401)
})
it.each(['ADMIN', 'MEMBER'] as const)(
  '%s manages only the session owner profile and logs',
  async (role) => {
    const s = setup(role)
    const read = await request(s.app).get(
      `/api/wellness?ownerMemberId=${other}`,
    )
    expect(read.status).toBe(200)
    expect(read.headers['cache-control']).toBe('no-store')
    expect(s.repository.read).toHaveBeenCalledWith(id, '2026-10-22')
    expect(read.body.wellness.summary).toMatchObject({
      currentWeightKg: 62.5,
      previousWeightKg: 62,
      changeKg: 0.5,
      bmi: 20.6,
    })
    expect(
      (await request(s.app).put('/api/wellness/profile').send(profile)).status,
    ).toBe(204)
    expect((await request(s.app).delete('/api/wellness/profile')).status).toBe(
      204,
    )
    const input = {
      loggedDate: '2026-10-22',
      weightKg: 62.5,
      note: ' Synthetic note ',
    }
    expect(
      (await request(s.app).post('/api/wellness/logs').send(input)).status,
    ).toBe(204)
    expect(
      (await request(s.app).put(`/api/wellness/logs/${other}`).send(input))
        .status,
    ).toBe(204)
    expect(
      (await request(s.app).delete(`/api/wellness/logs/${other}`)).status,
    ).toBe(204)
    expect(
      vi.mocked(s.repository.mutate).mock.calls.every((c) => c[0] === id),
    ).toBe(true)
    expect(vi.mocked(s.repository.mutate).mock.calls[2]![3]).toMatchObject({
      note: 'Synthetic note',
    })
  },
)
it('denies PARENT every Wellness read/write without touching storage', async () => {
  const s = setup('PARENT')
  for (const [method, path] of [
    ['get', ''],
    ['put', '/profile'],
    ['delete', '/profile'],
    ['post', '/logs'],
    ['put', `/logs/${id}`],
    ['delete', `/logs/${id}`],
  ] as const) {
    expect(
      (await request(s.app)[method](`/api/wellness${path}`).send({})).status,
    ).toBe(403)
  }
  expect(s.repository.read).not.toHaveBeenCalled()
  expect(s.repository.mutate).not.toHaveBeenCalled()
})
it.each([
  ['profile', { ...profile, heightCm: 99 }],
  ['profile', { ...profile, heightCm: 251 }],
  ['profile', { ...profile, heightCm: '174' }],
  ['profile', { ...profile, targetWeightKg: 19 }],
  ['profile', { ...profile, targetWeightKg: 351 }],
  ['profile', { ...profile, targetWeightKg: 64.001 }],
  ['profile', { ...profile, activityLevel: 'guessed' }],
  ['profile', { ...profile, ownerMemberId: other }],
  ['profile', { ...profile, sex: 'inferred' }],
  ['logs', { loggedDate: '2026-10-23', weightKg: 62.5 }],
  ['logs', { loggedDate: '2026-02-30', weightKg: 62.5 }],
  ['logs', { loggedDate: '2026-10-22', weightKg: 0 }],
  ['logs', { loggedDate: '2026-10-22', weightKg: 351 }],
  ['logs', { loggedDate: '2026-10-22', weightKg: '62.5' }],
  ['logs', { loggedDate: '2026-10-22', weightKg: 62.555 }],
  [
    'logs',
    { loggedDate: '2026-10-22', weightKg: 62.5, note: 'x'.repeat(1001) },
  ],
  [
    'logs',
    { loggedDate: '2026-10-22', weightKg: 62.5, owner_member_id: other },
  ],
] as const)('rejects unsafe %s input before storage', async (kind, input) => {
  const s = setup()
  const response =
    kind === 'profile'
      ? await request(s.app).put('/api/wellness/profile').send(input)
      : await request(s.app).post('/api/wellness/logs').send(input)
  expect(response.status).toBe(400)
  expect(s.repository.mutate).not.toHaveBeenCalled()
})
it('can clear all optional profile fields without inventing sensitive inputs', async () => {
  const s = setup()
  expect(
    (
      await request(s.app)
        .put('/api/wellness/profile')
        .send({ heightCm: null, targetWeightKg: null, activityLevel: null })
    ).status,
  ).toBe(204)
})
it('returns a safe unavailable response rather than storage details', async () => {
  const s = setup()
  vi.mocked(s.repository.read).mockRejectedValue(
    new Error('private SQL credential detail'),
  )
  const r = await request(s.app).get('/api/wellness')
  expect(r.status).toBe(503)
  expect(JSON.stringify(r.body)).not.toMatch(/SQL|credential|stack/)
})
it('computes previous change and actual observed 7/30-day spans without fabricated points', () => {
  const summary = calculateWellness(
    profile,
    [
      log('2026-10-22', 62.5),
      log('2026-10-20', 62.2),
      log('2026-10-16', 62),
      log('2026-09-24', 61.5),
      log('2026-09-22', 61),
    ],
    '2026-10-22',
  )
  expect(summary).toMatchObject({
    currentWeightKg: 62.5,
    previousWeightKg: 62.2,
    changeKg: 0.3,
    bmi: 20.6,
    trend7: {
      fromDate: '2026-10-16',
      toDate: '2026-10-22',
      changeKg: 0.5,
      pointCount: 3,
    },
    trend30: {
      fromDate: '2026-09-24',
      toDate: '2026-10-22',
      changeKg: 1,
      pointCount: 4,
    },
  })
  expect(summary).not.toHaveProperty('bmr')
  expect(summary).not.toHaveProperty('tdee')
})
it('keeps missing measurements, BMI and sparse trends honestly incomplete', () => {
  expect(calculateWellness(null, [], '2026-10-22')).toMatchObject({
    currentWeightKg: null,
    previousWeightKg: null,
    changeKg: null,
    bmi: null,
    trend7: null,
    trend30: null,
  })
  expect(
    calculateWellness(null, [log('2026-10-22', 62.5)], '2026-10-22'),
  ).toMatchObject({
    currentWeightKg: 62.5,
    bmi: null,
    changeKg: null,
    trend7: null,
  })
  expect(
    calculateWellness(
      profile,
      [log('2026-09-01', 62.5), log('2026-08-01', 63)],
      '2026-10-22',
    ),
  ).toMatchObject({ changeKg: -0.5, trend7: null, trend30: null })
})
it('uses inclusive calendar windows and does not mutate or impute source measurements', () => {
  const rows = [
    log('2026-10-15', 60),
    log('2026-10-22', 62.5),
    log('2026-10-16', 62),
    log('2026-09-23', 61),
    log('2026-09-22', 59),
  ]
  const before = JSON.stringify(rows)
  expect(calculateWellness(profile, rows, '2026-10-22')).toMatchObject({
    trend7: {
      fromDate: '2026-10-16',
      toDate: '2026-10-22',
      changeKg: 0.5,
      pointCount: 2,
    },
    trend30: {
      fromDate: '2026-09-23',
      toDate: '2026-10-22',
      changeKg: 1.5,
      pointCount: 4,
    },
  })
  expect(JSON.stringify(rows)).toBe(before)
})
it('caps only displayed history while calculating trends over the complete 30-day window', async () => {
  const s = setup()
  vi.mocked(s.repository.read).mockResolvedValue({
    profile,
    logs: Array.from({ length: 22 }, (_, i) =>
      log(`2026-10-${String(22 - i).padStart(2, '0')}`, 62.5 - i / 10),
    ),
  })
  const result = await s.service.read(s.actor)
  expect(result.logs).toHaveLength(14)
  expect(result.summary.trend30).toMatchObject({
    pointCount: 22,
    changeKg: 2.1,
  })
})
