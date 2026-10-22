import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { errorHandler } from '../src/middleware/error-handler.js'
import { createStudyRouter } from '../src/routes/study.routes.js'
import { StudyService, type StudyRepository } from '../src/services/study.service.js'
import type { FamilySessionOperations } from '../src/services/family-session.service.js'
import type { SafeFamilyProfile } from '../src/services/family-auth.service.js'

const id = '11111111-1111-4111-8111-111111111111'
const profile: SafeFamilyProfile = { id, role: 'MEMBER', displayName: 'Practice', avatarType: null, avatarValue: null }
const result = { id, sessionId: id, courseId: id, courseName: 'Listening', studiedAt: '2026-10-22', metricTitle: 'Test 1', score: 32, maxScore: 40, note: null, createdAt: '2026-10-22T00:00:00Z', updatedAt: '2026-10-22T00:00:00Z' }
function setup(role: SafeFamilyProfile['role'] = 'MEMBER') {
  const repository: StudyRepository = {
    readAssessments: vi.fn(async () => ({ courses: [], assessments: [] })),
    read: vi.fn(async () => ({ semesters: [], courses: [], goals: [], sessions: [], summary: { weekStart: '2026-10-19', weekEnd: '2026-10-25', totalMinutes: 0, sessionCount: 0, goals: [], courses: [] } })),
    mutate: vi.fn(async () => {}),
    readPractice: vi.fn(async () => ({ courses: [{ id, name: 'Listening', practiceTracking: true }], results: [result] })),
    mutatePractice: vi.fn(async () => {}),
  }
  const actor = { ...profile, role }
  const sessions = { authenticate: async () => ({ sessionId: 'private', profile: actor }) } as unknown as FamilySessionOperations
  const app = express().use(express.json()).use('/api/study', createStudyRouter(new StudyService(repository, () => new Date('2026-10-22T19:00:00Z')), sessions)).use(errorHandler)
  return { app, repository }
}
describe('practice-score API boundary', () => {
  it('reads only the authenticated owner practice view', async () => {
    const s = setup()
    const response = await request(s.app).get('/api/study/practice')
    expect(response.status).toBe(200)
    expect(response.body.practice.results[0]).not.toHaveProperty('ownerMemberId')
    expect(s.repository.readPractice).toHaveBeenCalledWith(id, null)
  })
  it('writes a result through the owner-scoped boundary', async () => {
    const s = setup()
    const response = await request(s.app).post('/api/study/practice').send({ sessionId: id, metricTitle: ' Test 1 ', score: 32, maxScore: 40, note: null })
    expect(response.status).toBe(204)
    expect(s.repository.mutatePractice).toHaveBeenCalledWith(id, null, expect.objectContaining({ metricTitle: 'Test 1' }), false)
  })
  it('rejects parent access and invalid input before storage', async () => {
    const s = setup('PARENT')
    expect((await request(s.app).get('/api/study/practice')).status).toBe(403)
    const member = setup()
    expect((await request(member.app).post('/api/study/practice').send({ sessionId: id, metricTitle: 'x', score: 41, maxScore: 40, note: null })).status).toBe(400)
    expect(member.repository.mutatePractice).not.toHaveBeenCalled()
  })
})
