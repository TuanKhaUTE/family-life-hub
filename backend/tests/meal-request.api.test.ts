import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import type { MealRequestOperations } from '../src/controllers/meal-request.controller.js'
import { SESSION_COOKIE_NAME } from '../src/http/session-cookie.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import { createMealRequestRouter } from '../src/routes/meal-request.routes.js'
import { generateSessionToken } from '../src/security/session-token.js'
import {
  MealRequestClosedError,
  MealRequestForbiddenError,
  type MealRequestView,
} from '../src/services/meal-request.service.js'
import type {
  AuthenticatedFamilySession,
  CreatedFamilySession,
  FamilySessionOperations,
} from '../src/services/family-session.service.js'
import { UnauthenticatedError } from '../src/services/family-session.service.js'

const token = generateSessionToken()
const profile = {
  id: '22222222-2222-4222-8222-222222222222',
  displayName: 'Synthetic Member',
  role: 'MEMBER' as const,
  avatarType: null,
  avatarValue: null,
}
const requestId = '44444444-4444-4444-8444-444444444444'
const view: MealRequestView = {
  id: requestId,
  mealDate: '2026-10-21',
  mealType: 'LUNCH',
  mode: 'OPEN_CHOICE',
  status: 'OPEN',
  deadlineAt: '2026-10-21T12:00:00Z',
  parentMessage: null,
  createdBy: {
    id: '11111111-1111-4111-8111-111111111111',
    displayName: 'Synthetic Parent',
  },
  options: [],
  createdAt: '2026-10-21T07:00:00Z',
  updatedAt: '2026-10-21T07:00:00Z',
  timeZone: 'Asia/Ho_Chi_Minh',
  isOpen: true,
  responses: [],
}
class Sessions implements FamilySessionOperations {
  async createSession(): Promise<CreatedFamilySession> {
    throw new Error()
  }
  async authenticate(
    value: string | null,
  ): Promise<AuthenticatedFamilySession> {
    if (value !== token) throw new UnauthenticatedError()
    return { sessionId: '99999999-9999-4999-8999-999999999999', profile }
  }
  async logout() {}
}
class Operations implements MealRequestOperations {
  error?: Error
  calls: Array<{ method: string; args: unknown[] }> = []
  async listCurrent(...args: Parameters<MealRequestOperations['listCurrent']>) {
    if (this.error) throw this.error
    this.calls.push({ method: 'list', args })
    return [view]
  }
  async create(...args: Parameters<MealRequestOperations['create']>) {
    if (this.error) throw this.error
    this.calls.push({ method: 'create', args })
    return view
  }
  async update(...args: Parameters<MealRequestOperations['update']>) {
    if (this.error) throw this.error
    this.calls.push({ method: 'update', args })
    return view
  }
  async saveResponse(
    ...args: Parameters<MealRequestOperations['saveResponse']>
  ) {
    if (this.error) throw this.error
    this.calls.push({ method: 'response', args })
    return { id: '55555555-5555-4555-8555-555555555555' } as never
  }
}
function setup() {
  const service = new Operations()
  const app = express()
  app.use(express.json())
  app.use(
    '/api/meals/requests',
    createMealRequestRouter(service, new Sessions()),
  )
  app.use(errorHandler)
  return { app, service }
}
function auth(test: request.Test) {
  return test.set('Cookie', `${SESSION_COOKIE_NAME}=${token}`)
}

describe('meal request API', () => {
  it('requires a session', async () => {
    const { app } = setup()
    const result = await request(app).get('/api/meals/requests/current')
    expect(result.status).toBe(401)
  })
  it('returns current requests in authenticated context', async () => {
    const { app, service } = setup()
    const result = await auth(request(app).get('/api/meals/requests/current'))
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ requests: [view] })
    expect(service.calls[0]!.args).toEqual([profile])
  })
  it('creates and updates through explicit routes', async () => {
    const { app, service } = setup()
    const body = {
      mealDate: '2026-10-21',
      mealType: 'LUNCH',
      mode: 'SELF_SERVICE',
    }
    expect(
      (await auth(request(app).post('/api/meals/requests').send(body))).status,
    ).toBe(201)
    expect(
      (
        await auth(
          request(app)
            .patch(`/api/meals/requests/${requestId}`)
            .send({ status: 'CLOSED' }),
        )
      ).status,
    ).toBe(200)
    expect(service.calls.map((call) => call.method)).toEqual([
      'create',
      'update',
    ])
  })
  it('submits only the authenticated member response', async () => {
    const { app, service } = setup()
    const body = { responseType: 'NOT_EATING' }
    const result = await auth(
      request(app).put(`/api/meals/requests/${requestId}/response`).send(body),
    )
    expect(result.status).toBe(200)
    expect(service.calls[0]).toEqual({
      method: 'response',
      args: [profile, requestId, body],
    })
  })
  it.each([
    [new MealRequestForbiddenError('forbidden'), 403, 'MEAL_FORBIDDEN'],
    [new MealRequestClosedError('closed'), 409, 'MEAL_CLOSED'],
  ])('returns safe domain errors', async (error, status, code) => {
    const { app, service } = setup()
    service.error = error
    const result = await auth(request(app).get('/api/meals/requests/current'))
    expect(result.status).toBe(status)
    expect(result.body).toEqual({ error: { code, message: error.message } })
    expect(JSON.stringify(result.body)).not.toContain('stack')
  })
})
