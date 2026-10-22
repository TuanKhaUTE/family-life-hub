import request from 'supertest'
import { describe, expect, it } from 'vitest'
import app from '../src/app.js'
import express from 'express'
import { vi } from 'vitest'
import {
  StudyService,
  type StudyRepository,
} from '../src/services/study.service.js'
import { createStudyRouter } from '../src/routes/study.routes.js'
import type { FamilySessionOperations } from '../src/services/family-session.service.js'
import type { SafeFamilyProfile } from '../src/services/family-auth.service.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import { ApiError } from '../src/errors/api-error.js'
const id = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222'
const inputs = {
  assessments: {
    courseId: other,
    title: 'Synthetic',
    assessmentType: 'MIDTERM',
    score: 8.7,
    maxScore: 10,
    letterGrade: null,
    weightPercent: 30,
    assessedAt: null,
    note: null,
  },
  semesters: {
    name: ' Semester ',
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    isActive: true,
  },
  courses: { semesterId: other, name: 'Course', code: null },
  goals: {
    courseId: null,
    title: 'Goal',
    targetMinutes: 300,
    targetDate: null,
    status: 'ACTIVE',
  },
  sessions: {
    courseId: null,
    studiedAt: '2026-10-22',
    durationMinutes: 90,
    note: null,
  },
}
function setup(role: SafeFamilyProfile['role'] = 'MEMBER') {
  const repository: StudyRepository = {
    readAssessments: vi.fn(async () => ({ courses: [], assessments: [] })),
    read: vi.fn(async () => ({
      semesters: [],
      courses: [],
      goals: [],
      sessions: [],
      summary: {
        weekStart: '2026-10-19',
        weekEnd: '2026-10-25',
        totalMinutes: 0,
        sessionCount: 0,
        goals: [],
        courses: [],
      },
    })),
    mutate: vi.fn(async () => {}),
  }
  const profile: SafeFamilyProfile = {
    id,
    role,
    displayName: 'Synthetic Study',
    avatarType: null,
    avatarValue: null,
  }
  const service = new StudyService(
    repository,
    () => new Date('2026-10-21T19:00:00Z'),
  )
  const sessions = {
    authenticate: async () => ({ sessionId: 'private', profile }),
  } as unknown as FamilySessionOperations
  return {
    repository,
    profile,
    service,
    app: express()
      .use(express.json())
      .use('/api/study', createStudyRouter(service, sessions))
      .use(errorHandler),
  }
}
describe('private Study API', () => {
  it('creates own numeric assessment through the existing Study boundary', async () => {
    const s = setup()
    const r = await request(s.app).post('/api/study/assessments').send({
      courseId: other,
      title: ' Synthetic assessment ',
      assessmentType: 'MIDTERM',
      score: 8.7,
      maxScore: 10,
      letterGrade: null,
      weightPercent: 30,
      assessedAt: null,
      note: null,
    })
    expect(r.status).toBe(204)
    expect(s.repository.mutate).toHaveBeenCalledWith(
      id,
      'assessments',
      null,
      expect.objectContaining({ title: 'Synthetic assessment', score: 8.7 }),
      false,
    )
  })
  it('requires a session before exposing the Study workspace', async () => {
    const result = await request(app).get('/api/study')
    expect(result.status).toBe(401)
  })
  it('requires authentication for assessment reads and mutations', async () => {
    expect((await request(app).get('/api/study/assessments')).status).toBe(401)
    expect(
      (
        await request(app)
          .post('/api/study/assessments')
          .send(inputs.assessments)
      ).status,
    ).toBe(401)
  })
  it.each(['ADMIN', 'MEMBER'] as const)(
    '%s reads only own grades, with an optional validated course filter',
    async (role) => {
      const s = setup(role)
      expect(
        (
          await request(s.app).get(
            `/api/study/assessments?ownerMemberId=${other}&courseId=${other}`,
          )
        ).status,
      ).toBe(200)
      expect(s.repository.readAssessments).toHaveBeenCalledWith(id, other)
      expect(
        (await request(s.app).get('/api/study/assessments?courseId=bad'))
          .status,
      ).toBe(400)
    },
  )
  it('PARENT cannot read grades, even with a forged owner query', async () => {
    const s = setup('PARENT')
    expect(
      (
        await request(s.app).get(
          `/api/study/assessments?ownerMemberId=${other}`,
        )
      ).status,
    ).toBe(403)
    expect(s.repository.readAssessments).not.toHaveBeenCalled()
  })
  it.each(['ADMIN', 'MEMBER'] as const)(
    '%s can edit/delete own assessment but receives safe denial for foreign IDs',
    async (role) => {
      const s = setup(role)
      expect(
        (
          await request(s.app)
            .put(`/api/study/assessments/${other}`)
            .send(inputs.assessments)
        ).status,
      ).toBe(204)
      expect(
        (await request(s.app).delete(`/api/study/assessments/${other}`)).status,
      ).toBe(204)
      vi.mocked(s.repository.mutate).mockRejectedValue(
        new ApiError(404, 'STUDY_NOT_FOUND', 'Study record not found'),
      )
      expect(
        (await request(s.app).delete(`/api/study/assessments/${other}`)).status,
      ).toBe(404)
    },
  )
  it.each(['ADMIN', 'MEMBER'] as const)(
    '%s reads only the authenticated workspace without owner query parameters',
    async (role) => {
      const s = setup(role)
      const result = await request(s.app).get(
        `/api/study?ownerMemberId=${other}`,
      )
      expect(result.status).toBe(200)
      expect(result.headers['cache-control']).toBe('no-store')
      expect(s.repository.read).toHaveBeenCalledWith(id, '2026-10-22')
      expect(JSON.stringify(result.body)).not.toMatch(
        /ownerMemberId|private|sessionId/,
      )
    },
  )
  it.each([
    'semesters',
    'courses',
    'goals',
    'sessions',
    'assessments',
  ] as const)('PARENT cannot read or mutate %s', async (kind) => {
    const s = setup('PARENT')
    expect((await request(s.app).get('/api/study')).status).toBe(403)
    expect(
      (await request(s.app).post(`/api/study/${kind}`).send(inputs[kind]))
        .status,
    ).toBe(403)
    expect(
      (
        await request(s.app)
          .put(`/api/study/${kind}/${other}`)
          .send(inputs[kind])
      ).status,
    ).toBe(403)
    expect(
      (await request(s.app).delete(`/api/study/${kind}/${other}`)).status,
    ).toBe(403)
    expect(s.repository.read).not.toHaveBeenCalled()
    expect(s.repository.mutate).not.toHaveBeenCalled()
  })
  it.each(['ADMIN', 'MEMBER'] as const)(
    '%s can CRUD each own entity through the session actor',
    async (role) => {
      const s = setup(role)
      for (const kind of [
        'semesters',
        'courses',
        'goals',
        'sessions',
      ] as const) {
        expect(
          (await request(s.app).post(`/api/study/${kind}`).send(inputs[kind]))
            .status,
        ).toBe(204)
        expect(
          (
            await request(s.app)
              .put(`/api/study/${kind}/${other}`)
              .send(inputs[kind])
          ).status,
        ).toBe(204)
        expect(
          (await request(s.app).delete(`/api/study/${kind}/${other}`)).status,
        ).toBe(204)
      }
      expect(
        vi.mocked(s.repository.mutate).mock.calls.every((c) => c[0] === id),
      ).toBe(true)
      expect(vi.mocked(s.repository.mutate).mock.calls[0]![3]).toMatchObject({
        name: 'Semester',
      })
    },
  )
  it.each([
    ['semesters', { ...inputs.semesters, name: ' ' }],
    ['semesters', { ...inputs.semesters, endDate: '2025-01-01' }],
    ['semesters', { ...inputs.semesters, startDate: '2026-02-30' }],
    ['semesters', { ...inputs.semesters, isActive: 'true' }],
    ['courses', { ...inputs.courses, semesterId: 'bad' }],
    ['courses', { ...inputs.courses, code: 'x'.repeat(41) }],
    ['goals', { ...inputs.goals, targetMinutes: 0 }],
    ['goals', { ...inputs.goals, targetMinutes: 10081 }],
    ['goals', { ...inputs.goals, status: 'SHARED' }],
    ['goals', { ...inputs.goals, targetDate: 'bad' }],
    ['sessions', { ...inputs.sessions, durationMinutes: 0 }],
    ['sessions', { ...inputs.sessions, durationMinutes: 1441 }],
    ['sessions', { ...inputs.sessions, durationMinutes: 1.5 }],
    ['sessions', { ...inputs.sessions, studiedAt: '2026-10-23' }],
    ['sessions', { ...inputs.sessions, note: 'x'.repeat(1001) }],
    ['sessions', { ...inputs.sessions, ownerMemberId: other }],
    ['sessions', { ...inputs.sessions, courseId: 'bad' }],
  ] as const)(
    'rejects invalid or owner-injected %s input',
    async (kind, input) => {
      const s = setup()
      expect(
        (await request(s.app).post(`/api/study/${kind}`).send(input)).status,
      ).toBe(400)
      expect(s.repository.mutate).not.toHaveBeenCalled()
    },
  )
  it('returns the same safe not-found error for foreign and missing records', async () => {
    const s = setup('ADMIN')
    vi.mocked(s.repository.mutate).mockRejectedValue(
      new ApiError(404, 'STUDY_NOT_FOUND', 'Study record not found'),
    )
    const r = await request(s.app).delete(`/api/study/sessions/${other}`)
    expect(r.status).toBe(404)
    expect(r.body).toEqual({
      error: { code: 'STUDY_NOT_FOUND', message: 'Study record not found' },
    })
  })
  it('hides unknown database/network details', async () => {
    const s = setup()
    vi.mocked(s.repository.read).mockRejectedValue(
      new Error('private SQL credentials'),
    )
    const r = await request(s.app).get('/api/study')
    expect(r.status).toBe(503)
    expect(JSON.stringify(r.body)).not.toMatch(/SQL|credentials|stack/)
  })
})
