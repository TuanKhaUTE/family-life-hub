import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import type { BreakfastOperations } from '../src/controllers/breakfast.controller.js'
import { SESSION_COOKIE_NAME } from '../src/http/session-cookie.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import { createBreakfastRouter } from '../src/routes/breakfast.routes.js'
import { generateSessionToken } from '../src/security/session-token.js'
import {
  BreakfastClosedError,
  BreakfastForbiddenError,
  BreakfastUnavailableError,
  BreakfastValidationError,
  type BreakfastCatalogItem,
  type BreakfastDay,
  type BreakfastDayResponse,
} from '../src/services/breakfast.service.js'
import type {
  AuthenticatedFamilySession,
  CreatedFamilySession,
  FamilySessionOperations,
} from '../src/services/family-session.service.js'
import { UnauthenticatedError } from '../src/services/family-session.service.js'

const memberId = '11111111-1111-4111-8111-111111111111'
const dishId = '44444444-4444-4444-8444-444444444444'
const date = '2026-10-22'
const token = generateSessionToken()
const profile = {
  id: memberId,
  displayName: 'Synthetic Member',
  role: 'MEMBER' as const,
  avatarType: null,
  avatarValue: null,
}
const catalog: BreakfastCatalogItem[] = [
  { id: dishId, name: 'Synthetic Dish', displayOrder: 1 },
]
const response: BreakfastDayResponse = {
  member: {
    id: memberId,
    displayName: 'Synthetic Member',
    avatarType: null,
    avatarValue: null,
  },
  state: 'NO_RESPONSE',
  catalogItem: null,
  customText: null,
  updatedAt: null,
}
const day: BreakfastDay = {
  date,
  deadlineAt: '2026-10-21T17:00:00.000Z',
  timeZone: 'Asia/Ho_Chi_Minh',
  isOpen: true,
  responses: [response],
}

class FakeBreakfastService implements BreakfastOperations {
  catalogResult = catalog
  dayResult = day
  saveResult: BreakfastDayResponse = {
    ...response,
    state: 'NOT_EATING',
    updatedAt: '2026-10-21T12:00:00.000Z',
  }
  error?: Error
  dayCalls: Array<{ profile: typeof profile; date: unknown }> = []
  saveCalls: Array<{
    profile: typeof profile
    date: unknown
    body: unknown
  }> = []

  async getCatalog(): Promise<BreakfastCatalogItem[]> {
    if (this.error) throw this.error
    return this.catalogResult
  }

  async getDay(
    requestedProfile: typeof profile,
    requestedDate: unknown,
  ): Promise<BreakfastDay> {
    if (this.error) throw this.error
    this.dayCalls.push({ profile: requestedProfile, date: requestedDate })
    return this.dayResult
  }

  async saveResponse(
    requestedProfile: typeof profile,
    requestedDate: unknown,
    body: unknown,
  ): Promise<BreakfastDayResponse> {
    if (this.error) throw this.error
    this.saveCalls.push({
      profile: requestedProfile,
      date: requestedDate,
      body,
    })
    return this.saveResult
  }
}

class FakeSessionService implements FamilySessionOperations {
  async createSession(): Promise<CreatedFamilySession> {
    throw new Error('not used')
  }

  async authenticate(
    presentedToken: string | null,
  ): Promise<AuthenticatedFamilySession> {
    if (presentedToken !== token) throw new UnauthenticatedError()
    return {
      sessionId: '22222222-2222-4222-8222-222222222222',
      profile,
    }
  }

  async logout(): Promise<void> {}
}

function createApp(service = new FakeBreakfastService()) {
  const app = express()
  app.use(express.json())
  app.use(
    '/api/breakfast',
    createBreakfastRouter(service, new FakeSessionService()),
  )
  app.use(errorHandler)
  return { app, service }
}

function authenticated(requestBuilder: request.Test): request.Test {
  return requestBuilder.set('Cookie', `${SESSION_COOKIE_NAME}=${token}`)
}

describe('breakfast API authentication and reads', () => {
  it('requires an authenticated session', async () => {
    const { app } = createApp()

    const result = await request(app).get('/api/breakfast/catalog')

    expect(result.status).toBe(401)
    expect(result.body).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication is required' },
    })
  })

  it('returns the safe active breakfast catalog', async () => {
    const { app } = createApp()

    const result = await authenticated(
      request(app).get('/api/breakfast/catalog'),
    )

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ items: catalog })
  })

  it('fetches the requested date with the authenticated profile context', async () => {
    const { app, service } = createApp()

    const result = await authenticated(
      request(app).get(`/api/breakfast/days/${date}`),
    )

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ day })
    expect(service.dayCalls).toEqual([{ profile, date }])
  })
})

describe('PUT /api/breakfast/days/:date/response', () => {
  it('submits only with the authenticated profile supplied by middleware', async () => {
    const { app, service } = createApp()
    const body = { state: 'NOT_EATING' }

    const result = await authenticated(
      request(app).put(`/api/breakfast/days/${date}/response`).send(body),
    )

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ response: service.saveResult })
    expect(service.saveCalls).toEqual([{ profile, date, body }])
  })

  it.each([
    {
      error: new BreakfastValidationError(),
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid breakfast request',
    },
    {
      error: new BreakfastForbiddenError(),
      status: 403,
      code: 'BREAKFAST_FORBIDDEN',
      message: 'This profile cannot submit a breakfast response',
    },
    {
      error: new BreakfastClosedError(),
      status: 409,
      code: 'BREAKFAST_CLOSED',
      message: 'Breakfast choices are closed for this date',
    },
    {
      error: new BreakfastUnavailableError(),
      status: 503,
      code: 'BREAKFAST_UNAVAILABLE',
      message: 'Breakfast information is temporarily unavailable',
    },
  ])('maps $code to a safe HTTP response', async (expected) => {
    const service = new FakeBreakfastService()
    service.error = expected.error
    const { app } = createApp(service)

    const result = await authenticated(
      request(app)
        .put(`/api/breakfast/days/${date}/response`)
        .send({ state: 'NOT_EATING' }),
    )

    expect(result.status).toBe(expected.status)
    expect(result.body).toEqual({
      error: { code: expected.code, message: expected.message },
    })
  })

  it('does not expose unexpected persistence details', async () => {
    const service = new FakeBreakfastService()
    service.error = new Error('secret database detail')
    const { app } = createApp(service)

    const result = await authenticated(
      request(app)
        .put(`/api/breakfast/days/${date}/response`)
        .send({ state: 'NOT_EATING' }),
    )

    expect(result.status).toBe(500)
    expect(result.body.error.code).toBe('INTERNAL_ERROR')
    expect(result.text).not.toContain('secret database detail')
  })
})
