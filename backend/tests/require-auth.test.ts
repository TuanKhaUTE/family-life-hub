import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { SESSION_COOKIE_NAME } from '../src/http/session-cookie.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import { createRequireAuth } from '../src/middleware/require-auth.js'
import { generateSessionToken } from '../src/security/session-token.js'
import type {
  AuthenticatedFamilySession,
  FamilySessionOperations,
} from '../src/services/family-session.service.js'
import {
  SessionUnavailableError,
  UnauthenticatedError,
} from '../src/services/family-session.service.js'

const context: AuthenticatedFamilySession = {
  sessionId: '22222222-2222-4222-8222-222222222222',
  profile: {
    id: '11111111-1111-4111-8111-111111111111',
    displayName: 'Synthetic Member',
    role: 'MEMBER',
    avatarType: null,
    avatarValue: null,
  },
}

class FakeSessionService implements FamilySessionOperations {
  readonly authenticationCalls: Array<string | null> = []
  result: AuthenticatedFamilySession = context
  error?: Error

  async createSession(): Promise<never> {
    throw new Error('not used')
  }

  async authenticate(token: string | null): Promise<AuthenticatedFamilySession> {
    this.authenticationCalls.push(token)
    if (this.error) throw this.error
    return this.result
  }

  async logout(): Promise<void> {}
}

function createApp(service: FamilySessionOperations) {
  const app = express()
  app.get('/protected', createRequireAuth(service), (request_, response) => {
    response.status(200).json({ auth: request_.auth })
  })
  app.use(errorHandler)
  return app
}

describe('createRequireAuth', () => {
  it('adds safe authenticated context for a valid session cookie', async () => {
    const service = new FakeSessionService()
    const token = generateSessionToken()

    const response = await request(createApp(service))
      .get('/protected')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${token}`)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ auth: context })
    expect(service.authenticationCalls).toEqual([token])
  })

  it.each([
    { label: 'missing', cookie: undefined },
    { label: 'malformed', cookie: `${SESSION_COOKIE_NAME}=malformed` },
    {
      label: 'unknown, expired, deleted, or inactive',
      cookie: `${SESSION_COOKIE_NAME}=${generateSessionToken()}`,
    },
  ])('returns the same safe 401 for a $label session', async ({ cookie }) => {
    const service = new FakeSessionService()
    service.error = new UnauthenticatedError()
    const pending = request(createApp(service)).get('/protected')
    if (cookie) pending.set('Cookie', cookie)

    const response = await pending

    expect(response.status).toBe(401)
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required',
      },
    })
  })

  it('returns a redacted availability error for a session-store failure', async () => {
    const service = new FakeSessionService()
    service.error = new SessionUnavailableError()

    const response = await request(createApp(service))
      .get('/protected')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${generateSessionToken()}`)

    expect(response.status).toBe(503)
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_UNAVAILABLE',
        message: 'Authentication is temporarily unavailable',
      },
    })
  })
})
