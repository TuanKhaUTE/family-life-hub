import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { SESSION_COOKIE_NAME } from '../src/http/session-cookie.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import type {
  AuthSessionRepository,
  AuthenticatedSessionRecord,
  NewAuthSession,
} from '../src/repositories/auth-session.repository.js'
import { createAuthRouter } from '../src/routes/auth.routes.js'
import {
  generateSessionToken,
  hashSessionToken,
} from '../src/security/session-token.js'
import {
  FamilyAuthService,
  type FamilyAuthRepository,
  type FamilyLoginRecord,
  type SafeFamilyProfile,
} from '../src/services/family-auth.service.js'
import { FamilySessionService } from '../src/services/family-session.service.js'

const memberId = '11111111-1111-4111-8111-111111111111'
const syntheticPin = '123456'
const syntheticHash = '$argon2id$synthetic-test-hash-value'
const now = new Date('2026-10-21T00:00:00.000Z')

const profile: SafeFamilyProfile = {
  id: memberId,
  displayName: 'Synthetic Member',
  role: 'MEMBER',
  avatarType: 'PRESET',
  avatarValue: 'avatar-one',
}

class ApiAuthRepository implements FamilyAuthRepository {
  profiles: SafeFamilyProfile[] = [profile]
  loginRecord: FamilyLoginRecord | null = {
    profile,
    pinHash: syntheticHash,
    failedAttemptCount: 0,
    lockedUntil: null,
  }
  listError?: Error
  completeResult = true
  findCalls = 0
  failedCalls = 0
  completeCalls = 0

  async listActiveProfiles(): Promise<SafeFamilyProfile[]> {
    if (this.listError) throw this.listError
    return this.profiles
  }

  async findActiveLoginRecord(): Promise<FamilyLoginRecord | null> {
    this.findCalls += 1
    return this.loginRecord
  }

  async recordFailedLogin(): Promise<void> {
    this.failedCalls += 1
  }

  async completeSuccessfulLogin(): Promise<boolean> {
    this.completeCalls += 1
    return this.completeResult
  }
}

interface StoredSession {
  record: AuthenticatedSessionRecord
  expiresAt: Date
  memberActive: boolean
}

class ApiSessionRepository implements AuthSessionRepository {
  readonly sessions = new Map<string, StoredSession>()
  readonly createCalls: NewAuthSession[] = []
  readonly deleteCalls: string[] = []
  error?: Error

  async createSession(session: NewAuthSession): Promise<void> {
    if (this.error) throw this.error
    this.createCalls.push(session)
    this.sessions.set(session.tokenHash, {
      record: {
        sessionId: crypto.randomUUID(),
        profile,
      },
      expiresAt: session.expiresAt,
      memberActive: true,
    })
  }

  async findAuthenticatedSession(
    tokenHash: string,
    requestedAt: Date,
  ): Promise<AuthenticatedSessionRecord | null> {
    if (this.error) throw this.error
    const stored = this.sessions.get(tokenHash)

    if (
      !stored ||
      !stored.memberActive ||
      stored.expiresAt.getTime() <= requestedAt.getTime()
    ) {
      return null
    }

    return stored.record
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    if (this.error) throw this.error
    this.deleteCalls.push(tokenHash)
    this.sessions.delete(tokenHash)
  }

  seed(token: string, expiresAt: Date, memberActive = true): void {
    this.sessions.set(hashSessionToken(token), {
      record: {
        sessionId: crypto.randomUUID(),
        profile,
      },
      expiresAt,
      memberActive,
    })
  }
}

function createHarness(
  authRepository = new ApiAuthRepository(),
  pinMatches = true,
  sessionRepository = new ApiSessionRepository(),
) {
  let verificationCalls = 0
  const sessionService = new FamilySessionService(
    sessionRepository,
    generateSessionToken,
    hashSessionToken,
    () => now,
  )
  const authService = new FamilyAuthService(
    authRepository,
    sessionService,
    async () => {
      verificationCalls += 1
      return pinMatches
    },
    () => now,
  )
  const app = express()
  app.use(express.json())
  app.use('/api/auth', createAuthRouter(authService, sessionService))
  app.use(errorHandler)

  return {
    app,
    authRepository,
    sessionRepository,
    get verificationCalls() {
      return verificationCalls
    },
  }
}

describe('GET /api/auth/profiles', () => {
  it('returns only safe active profile fields', async () => {
    const { app } = createHarness()

    const response = await request(app).get('/api/auth/profiles')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ profiles: [profile] })
    expect(response.text).not.toContain('pin_hash')
    expect(response.text).not.toContain('failed_attempt')
    expect(response.text).not.toContain('locked_until')
    expect(response.text).not.toContain(syntheticHash)
  })

  it('returns a redacted availability error when profiles cannot be loaded', async () => {
    const authRepository = new ApiAuthRepository()
    authRepository.listError = new Error(
      `upstream secret detail ${syntheticHash} ${syntheticPin}`,
    )
    const { app } = createHarness(authRepository)

    const response = await request(app).get('/api/auth/profiles')

    expect(response.status).toBe(503)
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_UNAVAILABLE',
        message: 'Authentication is temporarily unavailable',
      },
    })
    expect(response.text).not.toContain('upstream secret detail')
    expect(response.text).not.toContain(syntheticPin)
    expect(response.text).not.toContain(syntheticHash)
  })
})

describe('POST /api/auth/login', () => {
  it('creates a session, sets the safe cookie, and returns only the profile', async () => {
    const { app, authRepository, sessionRepository } = createHarness()

    const response = await request(app)
      .post('/api/auth/login')
      .send({ memberId, pin: syntheticPin })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ profile })
    expect(authRepository.completeCalls).toBe(1)
    expect(sessionRepository.createCalls).toHaveLength(1)
    expect(sessionRepository.createCalls[0]!.tokenHash).toMatch(
      /^[0-9a-f]{64}$/,
    )
    const cookie = response.headers['set-cookie']?.[0]
    expect(cookie).toMatch(/^family_session=[A-Za-z0-9_-]{43};/)
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('Expires=Wed, 28 Oct 2026 00:00:00 GMT')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).not.toContain('Secure')
    expect(cookie).not.toContain('Domain=')
    expect(response.body).not.toHaveProperty('token')
    expect(response.body).not.toHaveProperty('session')
    expect(response.text).not.toContain(syntheticPin)
    expect(response.text).not.toContain(syntheticHash)
  })

  it('creates no session or cookie for a failed PIN', async () => {
    const { app, sessionRepository } = createHarness(
      new ApiAuthRepository(),
      false,
    )

    const response = await request(app)
      .post('/api/auth/login')
      .send({ memberId, pin: syntheticPin })

    expect(response.status).toBe(401)
    expect(sessionRepository.createCalls).toEqual([])
    expect(response.headers['set-cookie']).toBeUndefined()
  })

  it('uses one non-enumerating response for wrong PIN, inactive member, and lockout', async () => {
    const wrongPin = createHarness(new ApiAuthRepository(), false)
    const inactiveRepository = new ApiAuthRepository()
    inactiveRepository.loginRecord = null
    const inactive = createHarness(inactiveRepository)
    const lockedRepository = new ApiAuthRepository()
    lockedRepository.loginRecord = {
      ...lockedRepository.loginRecord!,
      failedAttemptCount: 5,
      lockedUntil: new Date('2026-10-21T00:15:00.000Z'),
    }
    const locked = createHarness(lockedRepository)

    const responses = await Promise.all(
      [wrongPin.app, inactive.app, locked.app].map((app) =>
        request(app)
          .post('/api/auth/login')
          .send({ memberId, pin: syntheticPin }),
      ),
    )

    for (const response of responses) {
      expect(response.status).toBe(401)
      expect(response.body).toEqual({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Unable to verify family profile or PIN',
        },
      })
      expect(response.headers['set-cookie']).toBeUndefined()
    }

    expect(wrongPin.authRepository.failedCalls).toBe(1)
    expect(inactive.verificationCalls).toBe(0)
    expect(locked.verificationCalls).toBe(0)
  })

  it.each([
    { body: null, label: 'a null body' },
    { body: {}, label: 'missing fields' },
    { body: { memberId: 'not-a-uuid', pin: syntheticPin }, label: 'a bad UUID' },
    { body: { memberId, pin: '12345' }, label: 'a short PIN' },
  ])('returns a safe validation error for $label', async ({ body }) => {
    const { app, authRepository, sessionRepository } = createHarness()

    const response = await request(app).post('/api/auth/login').send(body)

    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'memberId and a six-digit PIN are required',
      },
    })
    expect(authRepository.findCalls).toBe(0)
    expect(sessionRepository.createCalls).toEqual([])
  })

  it('returns a safe validation error for malformed JSON', async () => {
    const { app, authRepository } = createHarness()

    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"memberId":')

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
    expect(authRepository.findCalls).toBe(0)
    expect(response.text).not.toContain('SyntaxError')
  })

  it('returns a redacted error and no cookie when session creation fails', async () => {
    const sessionRepository = new ApiSessionRepository()
    sessionRepository.error = new Error('secret database detail')
    const { app } = createHarness(
      new ApiAuthRepository(),
      true,
      sessionRepository,
    )

    const response = await request(app)
      .post('/api/auth/login')
      .send({ memberId, pin: syntheticPin })

    expect(response.status).toBe(503)
    expect(response.body.error.code).toBe('AUTH_UNAVAILABLE')
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(response.text).not.toContain('secret database detail')
  })
})

describe('GET /api/auth/me', () => {
  it('returns the safe profile for a valid login session', async () => {
    const { app } = createHarness()
    const agent = request.agent(app)

    await agent.post('/api/auth/login').send({ memberId, pin: syntheticPin })
    const response = await agent.get('/api/auth/me')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ profile })
    expect(response.text).not.toContain('sessionId')
    expect(response.text).not.toContain('token')
    expect(response.text).not.toContain('pin')
  })

  it.each([
    { label: 'missing', kind: 'missing' },
    { label: 'malformed', kind: 'malformed' },
    { label: 'unknown', kind: 'unknown' },
    { label: 'expired', kind: 'expired' },
    { label: 'inactive-member', kind: 'inactive' },
  ])('returns one generic 401 for a $label session', async ({ kind }) => {
    const sessionRepository = new ApiSessionRepository()
    const token = generateSessionToken()

    if (kind === 'expired') {
      sessionRepository.seed(token, new Date('2026-10-20T23:59:59.000Z'))
    } else if (kind === 'inactive') {
      sessionRepository.seed(token, new Date('2026-10-28T00:00:00.000Z'), false)
    }

    const { app } = createHarness(
      new ApiAuthRepository(),
      true,
      sessionRepository,
    )
    const pending = request(app).get('/api/auth/me')

    if (kind !== 'missing') {
      pending.set(
        'Cookie',
        `${SESSION_COOKIE_NAME}=${kind === 'malformed' ? 'malformed' : token}`,
      )
    }

    const response = await pending

    expect(response.status).toBe(401)
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required',
      },
    })
  })
})

describe('POST /api/auth/logout', () => {
  it('deletes only the current session and leaves another session valid', async () => {
    const { app, sessionRepository } = createHarness()
    const first = request.agent(app)
    const second = request.agent(app)
    await first.post('/api/auth/login').send({ memberId, pin: syntheticPin })
    await second.post('/api/auth/login').send({ memberId, pin: syntheticPin })

    const response = await first.post('/api/auth/logout')

    expect(response.status).toBe(204)
    expect(response.text).toBe('')
    expect(response.headers['set-cookie']?.[0]).toContain(
      `${SESSION_COOKIE_NAME}=;`,
    )
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly')
    expect(response.headers['set-cookie']?.[0]).toContain('SameSite=Lax')
    expect(sessionRepository.deleteCalls).toHaveLength(1)
    expect(sessionRepository.sessions.size).toBe(1)
    expect((await first.get('/api/auth/me')).status).toBe(401)
    expect((await second.get('/api/auth/me')).status).toBe(200)
  })

  it.each([undefined, 'malformed'])(
    'is an idempotent 204 and clears the cookie when token is %s',
    async (token) => {
      const { app, sessionRepository } = createHarness()
      const pending = request(app).post('/api/auth/logout')
      if (token) pending.set('Cookie', `${SESSION_COOKIE_NAME}=${token}`)

      const response = await pending

      expect(response.status).toBe(204)
      expect(response.headers['set-cookie']?.[0]).toContain(
        `${SESSION_COOKIE_NAME}=;`,
      )
      expect(sessionRepository.deleteCalls).toEqual([])
    },
  )

  it('returns the same idempotent response for an unknown well-formed token', async () => {
    const { app, sessionRepository } = createHarness()

    const response = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${generateSessionToken()}`)

    expect(response.status).toBe(204)
    expect(response.headers['set-cookie']?.[0]).toContain(
      `${SESSION_COOKIE_NAME}=;`,
    )
    expect(sessionRepository.deleteCalls).toHaveLength(1)
  })

  it('clears the cookie and returns a safe error when deletion fails', async () => {
    const sessionRepository = new ApiSessionRepository()
    const token = generateSessionToken()
    sessionRepository.seed(token, new Date('2026-10-28T00:00:00.000Z'))
    sessionRepository.error = new Error('secret database detail')
    const { app } = createHarness(
      new ApiAuthRepository(),
      true,
      sessionRepository,
    )

    const response = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${token}`)

    expect(response.status).toBe(503)
    expect(response.body.error.code).toBe('AUTH_UNAVAILABLE')
    expect(response.headers['set-cookie']?.[0]).toContain(
      `${SESSION_COOKIE_NAME}=;`,
    )
    expect(response.text).not.toContain('secret database detail')
  })
})
