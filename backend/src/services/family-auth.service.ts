import { verifyPin } from '../security/pin.js'
import type {
  CreatedFamilySession,
  FamilySessionOperations,
} from './family-session.service.js'

export type FamilyMemberRole = 'ADMIN' | 'PARENT' | 'MEMBER'

export interface SafeFamilyProfile {
  id: string
  displayName: string
  role: FamilyMemberRole
  avatarType: string | null
  avatarValue: string | null
}

export interface FamilyLoginRecord {
  profile: SafeFamilyProfile
  pinHash: string
  failedAttemptCount: number
  lockedUntil: Date | null
}

export interface SuccessfulFamilyLogin {
  profile: SafeFamilyProfile
  session: CreatedFamilySession
}

export interface FamilyAuthRepository {
  listActiveProfiles(): Promise<SafeFamilyProfile[]>
  findActiveLoginRecord(memberId: string): Promise<FamilyLoginRecord | null>
  recordFailedLogin(memberId: string): Promise<void>
  completeSuccessfulLogin(memberId: string): Promise<boolean>
}

type PinVerifier = (pin: string, pinHash: string) => Promise<boolean>
type Clock = () => Date

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SIX_ASCII_DIGITS = /^\d{6}$/

export class AuthValidationError extends Error {
  constructor() {
    super('memberId and a six-digit PIN are required')
    this.name = 'AuthValidationError'
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Unable to verify family profile or PIN')
    this.name = 'InvalidCredentialsError'
  }
}

export class AuthUnavailableError extends Error {
  constructor() {
    super('Authentication is temporarily unavailable')
    this.name = 'AuthUnavailableError'
  }
}

export class FamilyAuthService {
  constructor(
    private readonly repository: FamilyAuthRepository,
    private readonly sessionCreator: Pick<
      FamilySessionOperations,
      'createSession'
    >,
    private readonly pinVerifier: PinVerifier = verifyPin,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async listProfiles(): Promise<SafeFamilyProfile[]> {
    try {
      return await this.repository.listActiveProfiles()
    } catch {
      throw new AuthUnavailableError()
    }
  }

  async login(input: unknown): Promise<SuccessfulFamilyLogin> {
    const { memberId, pin } = validateLoginInput(input)
    const loginRecord = await this.findLoginRecord(memberId)

    if (!loginRecord || isActivelyLocked(loginRecord, this.clock())) {
      throw new InvalidCredentialsError()
    }

    const pinMatches = await this.verify(pin, loginRecord.pinHash)

    if (!pinMatches) {
      await this.recordFailure(memberId)
      throw new InvalidCredentialsError()
    }

    const completed = await this.completeSuccess(memberId)

    if (!completed) {
      throw new InvalidCredentialsError()
    }

    const session = await this.createSession(memberId)

    return { profile: loginRecord.profile, session }
  }

  private async findLoginRecord(
    memberId: string,
  ): Promise<FamilyLoginRecord | null> {
    try {
      return await this.repository.findActiveLoginRecord(memberId)
    } catch {
      throw new AuthUnavailableError()
    }
  }

  private async verify(pin: string, pinHash: string): Promise<boolean> {
    try {
      return await this.pinVerifier(pin, pinHash)
    } catch {
      throw new AuthUnavailableError()
    }
  }

  private async recordFailure(memberId: string): Promise<void> {
    try {
      await this.repository.recordFailedLogin(memberId)
    } catch {
      throw new AuthUnavailableError()
    }
  }

  private async completeSuccess(memberId: string): Promise<boolean> {
    try {
      return await this.repository.completeSuccessfulLogin(memberId)
    } catch {
      throw new AuthUnavailableError()
    }
  }

  private async createSession(memberId: string): Promise<CreatedFamilySession> {
    try {
      return await this.sessionCreator.createSession(memberId)
    } catch {
      throw new AuthUnavailableError()
    }
  }
}

function validateLoginInput(input: unknown): {
  memberId: string
  pin: string
} {
  if (!input || typeof input !== 'object') {
    throw new AuthValidationError()
  }

  const candidate = input as Record<string, unknown>

  if (
    typeof candidate.memberId !== 'string' ||
    !UUID_PATTERN.test(candidate.memberId) ||
    typeof candidate.pin !== 'string' ||
    !SIX_ASCII_DIGITS.test(candidate.pin)
  ) {
    throw new AuthValidationError()
  }

  return { memberId: candidate.memberId, pin: candidate.pin }
}

function isActivelyLocked(record: FamilyLoginRecord, now: Date): boolean {
  return record.lockedUntil !== null && record.lockedUntil.getTime() > now.getTime()
}
