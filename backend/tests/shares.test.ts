import request from 'supertest'
import express from 'express'
import { expect, it, vi } from 'vitest'
import app from '../src/app.js'
import {
  ShareService,
  type ShareRepository,
} from '../src/services/share.service.js'
import { SupabaseShareRepository } from '../src/repositories/share.repository.js'
import { createShareRouter } from '../src/routes/share.routes.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import type { FamilySessionOperations } from '../src/services/family-session.service.js'
import type { SafeFamilyProfile } from '../src/services/family-auth.service.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from '../src/errors/api-error.js'
const id = '11111111-1111-4111-8111-111111111111',
  recipient = '22222222-2222-4222-8222-222222222222'
const input = {
  resourceType: 'STUDY_ASSESSMENT',
  resourceId: id,
  recipientMemberId: recipient,
}
function setup(role: SafeFamilyProfile['role'] = 'MEMBER') {
  const profile = {
    id,
    role,
    displayName: 'Synthetic Owner',
    avatarType: null,
    avatarValue: null,
  }
  const repository: ShareRepository = {
    owner: vi.fn(async () => ({
      recipients: [
        {
          id: recipient,
          displayName: 'Synthetic Recipient',
          avatarType: null,
          avatarValue: null,
        },
      ],
      shares: [],
    })),
    received: vi.fn(async () => ({ records: [], totalCount: 0 })),
    create: vi.fn(async () => id),
    revoke: vi.fn(async () => {}),
  }
  const service = new ShareService(repository)
  const sessions = {
    authenticate: async () => ({ sessionId: 'synthetic', profile }),
  } as unknown as FamilySessionOperations
  return {
    profile,
    repository,
    service,
    app: express()
      .use(express.json())
      .use('/shares', createShareRouter(service, sessions))
      .use(errorHandler),
  }
}
it('requires a session before revealing any received private share', async () => {
  expect((await request(app).get('/api/shares/received')).status).toBe(401)
})
it('all share management paths require sessions too', async () => {
  expect(
    (
      await request(app).get(
        '/api/shares?resourceType=STUDY_ASSESSMENT&resourceId=' + id,
      )
    ).status,
  ).toBe(401)
  expect((await request(app).post('/api/shares').send(input)).status).toBe(401)
  expect((await request(app).delete('/api/shares/' + id)).status).toBe(401)
})
it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
  '%s receives only session-scoped shared rows; caller cannot select another recipient',
  async (role) => {
    const s = setup(role),
      r = await request(s.app).get(
        '/shares/received?recipientMemberId=' + recipient,
      )
    expect(r.status).toBe(200)
    expect(r.body.received).toEqual({
      records: [],
      totalCount: 0,
      page: 1,
      hasMore: false,
    })
    expect(r.headers['cache-control']).toBe('no-store')
    expect(s.repository.received).toHaveBeenCalledWith(id, 1)
  },
)
it.each(['ADMIN', 'MEMBER'] as const)(
  '%s creates/revokes only through the session actor',
  async (role) => {
    const s = setup(role)
    expect((await request(s.app).post('/shares').send(input)).status).toBe(201)
    expect(s.repository.create).toHaveBeenCalledWith(
      id,
      'STUDY_ASSESSMENT',
      id,
      recipient,
    )
    expect((await request(s.app).delete('/shares/' + id)).status).toBe(204)
    expect(s.repository.revoke).toHaveBeenCalledWith(id, id)
    expect(
      (
        await request(s.app).get(
          '/shares?resourceType=STUDY_ASSESSMENT&resourceId=' + id,
        )
      ).status,
    ).toBe(200)
    expect(s.repository.owner).toHaveBeenCalledWith(id, 'STUDY_ASSESSMENT', id)
  },
)
it('PARENT receives explicit shares but cannot use owner management', async () => {
  const s = setup('PARENT')
  expect((await request(s.app).post('/shares').send(input)).status).toBe(403)
  expect((await request(s.app).delete('/shares/' + id)).status).toBe(403)
  expect(
    (
      await request(s.app).get(
        '/shares?resourceType=STUDY_ASSESSMENT&resourceId=' + id,
      )
    ).status,
  ).toBe(403)
  expect(s.repository.create).not.toHaveBeenCalled()
  expect(s.repository.revoke).not.toHaveBeenCalled()
})
it.each([
  { ...input, resourceType: 'FITNESS_SESSION' },
  { ...input, resourceType: 'WELLNESS_WEIGHT_LOG' },
  { ...input, resourceType: 'PERSONAL_EXPENSE' },
  { ...input, resourceType: ['STUDY_ASSESSMENT'] },
  { ...input, resourceId: 'bad' },
  { ...input, recipientMemberId: id },
  { ...input, ownerMemberId: recipient },
  { ...input, note: 'do not share notes' },
])('rejects unsupported/forged sharing input %#', async (value) => {
  const s = setup()
  expect((await request(s.app).post('/shares').send(value)).status).toBe(400)
  expect(s.repository.create).not.toHaveBeenCalled()
})
it('foreign/missing source denial and storage failures expose safe errors only', async () => {
  const s = setup()
  vi.mocked(s.repository.create).mockRejectedValueOnce(
    new ApiError(404, 'SHARE_NOT_FOUND', 'Record not found'),
  )
  expect((await request(s.app).post('/shares').send(input)).status).toBe(404)
  vi.mocked(s.repository.received).mockRejectedValueOnce(
    new Error('SQL secret'),
  )
  const r = await request(s.app).get('/shares/received')
  expect(r.status).toBe(503)
  expect(JSON.stringify(r.body)).not.toContain('SQL secret')
})
it.each(['0', '-1', '1.5', '100001'])(
  'rejects invalid received pagination %s',
  async (page) => {
    expect(
      (await request(setup().app).get('/shares/received?page=' + page)).status,
    ).toBe(400)
  },
)
it('repository reconstructs only the approved safe assessment projection and computes percentage', async () => {
  const rpc = vi.fn(async () => ({
    data: {
      records: [
        {
          id,
          resourceType: 'STUDY_ASSESSMENT',
          sharedAt: '2026-10-22T00:00:00Z',
          owner: {
            id: recipient,
            displayName: 'Synthetic Owner',
            avatarType: null,
            avatarValue: null,
          },
          assessment: {
            courseId: id,
            courseName: 'Synthetic Course',
            title: 'Synthetic Midterm',
            assessmentType: 'MIDTERM',
            score: 8.7,
            maxScore: 10,
            letterGrade: null,
            assessedAt: '2026-10-22',
            note: 'secret note',
            weightPercent: 30,
          },
          sessions: ['private'],
        },
      ],
      totalCount: 1,
    },
    error: null,
  }))
  const repository = new SupabaseShareRepository(
    () => ({ rpc }) as unknown as SupabaseClient,
  )
  expect(await repository.received(recipient, 1)).toEqual({
    records: [
      {
        id,
        resourceType: 'STUDY_ASSESSMENT',
        sharedAt: '2026-10-22T00:00:00Z',
        owner: {
          displayName: 'Synthetic Owner',
          avatarType: null,
          avatarValue: null,
        },
        assessment: {
          courseName: 'Synthetic Course',
          title: 'Synthetic Midterm',
          assessmentType: 'MIDTERM',
          score: 8.7,
          maxScore: 10,
          letterGrade: null,
          assessedAt: '2026-10-22',
          percentage: 87,
        },
      },
    ],
    totalCount: 1,
  })
  expect(rpc).toHaveBeenCalledWith('private_share_received', {
    p_actor_member_id: recipient,
    p_page: 1,
  })
})
