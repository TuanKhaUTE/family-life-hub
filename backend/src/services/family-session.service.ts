import { SESSION_LIFETIME_MS } from '../http/session-cookie.js'
import type {
  AuthSessionRepository,
  AuthenticatedSessionRecord,
} from '../repositories/auth-session.repository.js'
import {
  generateSessionToken,
  hashSessionToken,
  isSessionToken,
} from '../security/session-token.js'

export type AuthenticatedFamilySession = AuthenticatedSessionRecord

export interface CreatedFamilySession {
  token: string
  expiresAt: Date
}

export interface FamilySessionOperations {
  createSession(
    memberId: string,
    verifiedPinHash: string,
  ): Promise<CreatedFamilySession>
  authenticate(token: string | null): Promise<AuthenticatedFamilySession>
  logout(token: string | null): Promise<void>
}

type TokenGenerator = () => string
type TokenHasher = (token: string) => string
type Clock = () => Date

export class UnauthenticatedError extends Error {
  constructor() {
    super('Authentication is required')
    this.name = 'UnauthenticatedError'
  }
}

export class SessionUnavailableError extends Error {
  constructor() {
    super('Authentication is temporarily unavailable')
    this.name = 'SessionUnavailableError'
  }
}

export class FamilySessionService implements FamilySessionOperations {
  constructor(
    private readonly repository: AuthSessionRepository,
    private readonly tokenGenerator: TokenGenerator = generateSessionToken,
    private readonly tokenHasher: TokenHasher = hashSessionToken,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async createSession(
    memberId: string,
    verifiedPinHash: string,
  ): Promise<CreatedFamilySession> {
    try {
      const token = this.tokenGenerator()

      if (!isSessionToken(token)) {
        throw new Error('Invalid generated session token')
      }

      const expiresAt = new Date(this.clock().getTime() + SESSION_LIFETIME_MS)
      await this.repository.createSession({
        memberId,
        verifiedPinHash,
        tokenHash: this.tokenHasher(token),
        expiresAt,
      })

      return { token, expiresAt }
    } catch {
      throw new SessionUnavailableError()
    }
  }

  async authenticate(
    token: string | null,
  ): Promise<AuthenticatedFamilySession> {
    if (token === null || !isSessionToken(token)) {
      throw new UnauthenticatedError()
    }

    try {
      const session = await this.repository.findAuthenticatedSession(
        this.tokenHasher(token),
        this.clock(),
      )

      if (session === null) {
        throw new UnauthenticatedError()
      }

      return session
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        throw error
      }

      throw new SessionUnavailableError()
    }
  }

  async logout(token: string | null): Promise<void> {
    if (token === null || !isSessionToken(token)) {
      return
    }

    try {
      await this.repository.deleteByTokenHash(this.tokenHasher(token))
    } catch {
      throw new SessionUnavailableError()
    }
  }
}
