import { describe, expect, it } from 'vitest'

import type {
  AuthSessionRepository,
  AuthenticatedSessionRecord,
  NewAuthSession,
} from '../src/repositories/auth-session.repository.js'
import {
  generateSessionToken,
  hashSessionToken,
} from '../src/security/session-token.js'
import {
  FamilySessionService,
  SessionUnavailableError,
  UnauthenticatedError,
} from '../src/services/family-session.service.js'

class FakeSessionRepository implements AuthSessionRepository {
  readonly sessions = new Map<string, AuthenticatedSessionRecord>()
  readonly createCalls: NewAuthSession[] = []
  readonly findCalls: Array<{ tokenHash: string; now: Date }> = []
  readonly deleteCalls: string[] = []
  error?: Error

  async createSession(session: NewAuthSession): Promise<void> {
    if (this.error) throw this.error
    this.createCalls.push(session)
    this.sessions.set(session.tokenHash, authenticatedSession)
  }

  async findAuthenticatedSession(
    tokenHash: string,
    now: Date,
  ): Promise<AuthenticatedSessionRecord | null> {
    if (this.error) throw this.error
    this.findCalls.push({ tokenHash, now })
    return this.sessions.get(tokenHash) ?? null
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    if (this.error) throw this.error
    this.deleteCalls.push(tokenHash)
    this.sessions.delete(tokenHash)
  }
}

const memberId = '11111111-1111-4111-8111-111111111111'
const authenticatedSession: AuthenticatedSessionRecord = {
  sessionId: '22222222-2222-4222-8222-222222222222',
  profile: {
    id: memberId,
    displayName: 'Synthetic Member',
    role: 'MEMBER',
    avatarType: null,
    avatarValue: null,
  },
}
const now = new Date('2026-10-21T00:00:00.000Z')

describe('FamilySessionService.createSession', () => {
  it('persists only the hash with an exact seven-day expiry', async () => {
    const repository = new FakeSessionRepository()
    const rawToken = generateSessionToken()
    const expectedHash = 'a'.repeat(64)
    const service = new FamilySessionService(
      repository,
      () => rawToken,
      () => expectedHash,
      () => now,
    )

    await expect(service.createSession(memberId)).resolves.toEqual({
      token: rawToken,
      expiresAt: new Date('2026-10-28T00:00:00.000Z'),
    })
    expect(repository.createCalls).toEqual([
      {
        memberId,
        tokenHash: expectedHash,
        expiresAt: new Date('2026-10-28T00:00:00.000Z'),
      },
    ])
    expect(JSON.stringify(repository.createCalls)).not.toContain(rawToken)
  })

  it('redacts token-generation and repository failures', async () => {
    const repository = new FakeSessionRepository()
    repository.error = new Error('secret database detail')
    const service = new FamilySessionService(repository)

    const result = service.createSession(memberId)

    await expect(result).rejects.toBeInstanceOf(SessionUnavailableError)
    await expect(result).rejects.not.toThrow('secret')
  })
})

describe('FamilySessionService authentication and logout', () => {
  it('authenticates and independently revokes multiple sessions for one member', async () => {
    const repository = new FakeSessionRepository()
    const tokens = [generateSessionToken(), generateSessionToken()]
    let tokenIndex = 0
    const service = new FamilySessionService(
      repository,
      () => tokens[tokenIndex++]!,
      hashSessionToken,
      () => now,
    )

    const first = await service.createSession(memberId)
    const second = await service.createSession(memberId)

    await expect(service.authenticate(first.token)).resolves.toEqual(
      authenticatedSession,
    )
    await expect(service.authenticate(second.token)).resolves.toEqual(
      authenticatedSession,
    )

    await service.logout(first.token)

    await expect(service.authenticate(first.token)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    )
    await expect(service.authenticate(second.token)).resolves.toEqual(
      authenticatedSession,
    )
  })

  it.each([null, '', 'malformed'])(
    'rejects a missing or malformed token generically without database access: %s',
    async (token) => {
      const repository = new FakeSessionRepository()
      const service = new FamilySessionService(repository)

      await expect(service.authenticate(token)).rejects.toBeInstanceOf(
        UnauthenticatedError,
      )
      expect(repository.findCalls).toEqual([])
    },
  )

  it('uses the same generic rejection for an unknown, expired, or inactive session', async () => {
    const repository = new FakeSessionRepository()
    const service = new FamilySessionService(
      repository,
      undefined,
      undefined,
      () => now,
    )
    const token = generateSessionToken()

    await expect(service.authenticate(token)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    )
    expect(repository.findCalls).toEqual([
      { tokenHash: hashSessionToken(token), now },
    ])
  })

  it.each([null, '', 'malformed'])(
    'makes logout a no-op for an absent or invalid token: %s',
    async (token) => {
      const repository = new FakeSessionRepository()
      const service = new FamilySessionService(repository)

      await expect(service.logout(token)).resolves.toBeUndefined()
      expect(repository.deleteCalls).toEqual([])
    },
  )

  it('redacts repository failures during authentication and logout', async () => {
    const repository = new FakeSessionRepository()
    repository.error = new Error('secret database detail')
    const service = new FamilySessionService(repository)
    const token = generateSessionToken()

    await expect(service.authenticate(token)).rejects.toBeInstanceOf(
      SessionUnavailableError,
    )
    await expect(service.logout(token)).rejects.toBeInstanceOf(
      SessionUnavailableError,
    )
  })
})
