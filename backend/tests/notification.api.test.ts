import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import type { NotificationOperations } from '../src/controllers/notification.controller.js'
import { SESSION_COOKIE_NAME } from '../src/http/session-cookie.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import { createNotificationRouter } from '../src/routes/notification.routes.js'
import { generateSessionToken } from '../src/security/session-token.js'
import type {
  AuthenticatedFamilySession,
  CreatedFamilySession,
  FamilySessionOperations,
} from '../src/services/family-session.service.js'
import { UnauthenticatedError } from '../src/services/family-session.service.js'
import {
  NotificationNotFoundError,
  NotificationUnavailableError,
  NotificationValidationError,
  type AppNotification,
} from '../src/services/notification.service.js'

const memberId = '11111111-1111-4111-8111-111111111111'
const notificationId = '22222222-2222-4222-8222-222222222222'
const token = generateSessionToken()
const profile = {
  id: memberId,
  displayName: 'Synthetic Member',
  role: 'MEMBER' as const,
  avatarType: null,
  avatarValue: null,
}
const notification: AppNotification = {
  id: notificationId,
  type: 'BREAKFAST_PURCHASED',
  title: 'Breakfast purchased',
  message: 'Breakfast is ready',
  relatedResourceType: 'BREAKFAST_PURCHASE',
  relatedResourceId: '33333333-3333-4333-8333-333333333333',
  relatedDate: '2026-10-22',
  readAt: null,
  createdAt: '2026-10-21T12:00:00.000Z',
}

class FakeOperations implements NotificationOperations {
  countCalls: string[] = []
  async countUnread(id: string) {
    this.countCalls.push(id)
    return 1
  }
  error?: Error
  listCalls: string[] = []
  readCalls: Array<{ memberId: string; notificationId: unknown }> = []
  async list(requestedMemberId: string): Promise<AppNotification[]> {
    if (this.error) throw this.error
    this.listCalls.push(requestedMemberId)
    return [notification]
  }
  async markRead(
    requestedMemberId: string,
    requestedId: unknown,
  ): Promise<AppNotification> {
    if (this.error) throw this.error
    this.readCalls.push({
      memberId: requestedMemberId,
      notificationId: requestedId,
    })
    return { ...notification, readAt: '2026-10-21T13:00:00.000Z' }
  }
}

class Sessions implements FamilySessionOperations {
  async createSession(): Promise<CreatedFamilySession> {
    throw new Error('not used')
  }
  async authenticate(
    presented: string | null,
  ): Promise<AuthenticatedFamilySession> {
    if (presented !== token) throw new UnauthenticatedError()
    return { sessionId: '44444444-4444-4444-8444-444444444444', profile }
  }
  async logout(): Promise<void> {}
}

function harness(service = new FakeOperations()) {
  const app = express()
  app.use(express.json())
  app.use(
    '/api/notifications',
    createNotificationRouter(service, new Sessions()),
  )
  app.use(errorHandler)
  return { app, service }
}

function authenticated(builder: request.Test): request.Test {
  return builder.set('Cookie', `${SESSION_COOKIE_NAME}=${token}`)
}

describe('notification API', () => {
  it('requires a session', async () => {
    const result = await request(harness().app).get('/api/notifications')
    expect(result.status).toBe(401)
  })

  it('lists only for the authenticated member', async () => {
    const { app, service } = harness()
    const result = await authenticated(request(app).get('/api/notifications'))
    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      notifications: [notification],
      unreadCount: 1,
    })
    expect(service.countCalls).toEqual([memberId])
    expect(service.listCalls).toEqual([memberId])
  })

  it('marks only through authenticated ownership scope', async () => {
    const { app, service } = harness()
    const result = await authenticated(
      request(app).patch(`/api/notifications/${notificationId}/read`).send({}),
    )
    expect(result.status).toBe(200)
    expect(result.body.notification.readAt).toBe('2026-10-21T13:00:00.000Z')
    expect(service.readCalls).toEqual([{ memberId, notificationId }])
  })

  it.each([
    [new NotificationValidationError(), 400, 'VALIDATION_ERROR'],
    [new NotificationNotFoundError(), 404, 'NOTIFICATION_NOT_FOUND'],
    [new NotificationUnavailableError(), 503, 'NOTIFICATION_UNAVAILABLE'],
  ])('maps a safe service error', async (error, status, code) => {
    const service = new FakeOperations()
    service.error = error
    const result = await authenticated(
      request(harness(service).app)
        .patch(`/api/notifications/${notificationId}/read`)
        .send({}),
    )
    expect(result.status).toBe(status)
    expect(result.body.error.code).toBe(code)
  })

  it('does not expose unexpected details', async () => {
    const service = new FakeOperations()
    service.error = new Error('secret database detail')
    const result = await authenticated(
      request(harness(service).app).get('/api/notifications'),
    )
    expect(result.status).toBe(500)
    expect(result.text).not.toContain('secret database detail')
  })
})
