import { describe, expect, it } from 'vitest'

import {
  AuthUnavailableError,
  AuthValidationError,
  FamilyAuthService,
  InvalidCredentialsError,
  type FamilyAuthRepository,
  type FamilyLoginRecord,
  type SafeFamilyProfile,
} from '../src/services/family-auth.service.js'

const memberId = '11111111-1111-4111-8111-111111111111'
const syntheticPin = '123456'
const syntheticHash = '$argon2id$synthetic-test-hash-value'
const now = new Date('2026-10-21T00:00:00.000Z')

const profile: SafeFamilyProfile = {
  id: memberId,
  displayName: 'Synthetic Member',
  role: 'MEMBER',
  avatarType: null,
  avatarValue: null,
}

class FakeAuthRepository implements FamilyAuthRepository {
  profiles: SafeFamilyProfile[] = [profile]
  loginRecord: FamilyLoginRecord | null = {
    profile,
    pinHash: syntheticHash,
    failedAttemptCount: 0,
    lockedUntil: null,
  }
  completeResult = true
  listError?: Error
  findError?: Error
  failureError?: Error
  completeError?: Error
  findCalls: string[] = []
  failedCalls: string[] = []
  completeCalls: string[] = []

  async listActiveProfiles(): Promise<SafeFamilyProfile[]> {
    if (this.listError) {
      throw this.listError
    }

    return this.profiles
  }

  async findActiveLoginRecord(
    requestedMemberId: string,
  ): Promise<FamilyLoginRecord | null> {
    this.findCalls.push(requestedMemberId)

    if (this.findError) {
      throw this.findError
    }

    return this.loginRecord
  }

  async recordFailedLogin(requestedMemberId: string): Promise<void> {
    this.failedCalls.push(requestedMemberId)

    if (this.failureError) {
      throw this.failureError
    }
  }

  async completeSuccessfulLogin(requestedMemberId: string): Promise<boolean> {
    this.completeCalls.push(requestedMemberId)

    if (this.completeError) {
      throw this.completeError
    }

    return this.completeResult
  }
}

function createHarness(repository = new FakeAuthRepository()) {
  const verificationCalls: Array<{ pin: string; pinHash: string }> = []
  let verificationResult = true
  let verificationError: Error | undefined
  const service = new FamilyAuthService(
    repository,
    async (pin, pinHash) => {
      verificationCalls.push({ pin, pinHash })

      if (verificationError) {
        throw verificationError
      }

      return verificationResult
    },
    () => now,
  )

  return {
    repository,
    service,
    verificationCalls,
    setVerificationResult(value: boolean) {
      verificationResult = value
    },
    setVerificationError(error: Error) {
      verificationError = error
    },
  }
}

describe('FamilyAuthService.listProfiles', () => {
  it('returns the safe active profiles supplied by the repository', async () => {
    const { service } = createHarness()

    await expect(service.listProfiles()).resolves.toEqual([profile])
  })

  it('turns repository failures into a safe availability error', async () => {
    const repository = new FakeAuthRepository()
    repository.listError = new Error('upstream secret detail')
    const { service } = createHarness(repository)

    const result = service.listProfiles()

    await expect(result).rejects.toBeInstanceOf(AuthUnavailableError)
    await expect(result).rejects.not.toThrow('upstream secret detail')
  })
})

describe('FamilyAuthService.login', () => {
  it('returns a safe profile and resets state after a matching PIN', async () => {
    const { repository, service, verificationCalls } = createHarness()

    await expect(service.login({ memberId, pin: syntheticPin })).resolves.toEqual(
      profile,
    )
    expect(verificationCalls).toEqual([
      { pin: syntheticPin, pinHash: syntheticHash },
    ])
    expect(repository.failedCalls).toEqual([])
    expect(repository.completeCalls).toEqual([memberId])
  })

  it('records a failed attempt and returns invalid credentials for a wrong PIN', async () => {
    const harness = createHarness()
    harness.setVerificationResult(false)

    const result = harness.service.login({ memberId, pin: syntheticPin })

    await expect(result).rejects.toBeInstanceOf(InvalidCredentialsError)
    expect(harness.repository.failedCalls).toEqual([memberId])
    expect(harness.repository.completeCalls).toEqual([])
  })

  it('rejects a missing or inactive member without verifying a PIN', async () => {
    const repository = new FakeAuthRepository()
    repository.loginRecord = null
    const { service, verificationCalls } = createHarness(repository)

    await expect(
      service.login({ memberId, pin: syntheticPin }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
    expect(verificationCalls).toEqual([])
    expect(repository.failedCalls).toEqual([])
    expect(repository.completeCalls).toEqual([])
  })

  it('rejects an active lock without invoking Argon2 or changing state', async () => {
    const repository = new FakeAuthRepository()
    repository.loginRecord = {
      ...repository.loginRecord!,
      failedAttemptCount: 5,
      lockedUntil: new Date('2026-10-21T00:14:59.000Z'),
    }
    const { service, verificationCalls } = createHarness(repository)

    await expect(
      service.login({ memberId, pin: syntheticPin }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
    expect(verificationCalls).toEqual([])
    expect(repository.failedCalls).toEqual([])
    expect(repository.completeCalls).toEqual([])
  })

  it('records a new failed sequence after a lock has expired', async () => {
    const repository = new FakeAuthRepository()
    repository.loginRecord = {
      ...repository.loginRecord!,
      failedAttemptCount: 5,
      lockedUntil: new Date('2026-10-20T23:59:59.000Z'),
    }
    const harness = createHarness(repository)
    harness.setVerificationResult(false)

    await expect(
      harness.service.login({ memberId, pin: syntheticPin }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
    expect(harness.verificationCalls).toHaveLength(1)
    expect(repository.failedCalls).toEqual([memberId])
  })

  it('allows an expired lock to be reset after successful verification', async () => {
    const repository = new FakeAuthRepository()
    repository.loginRecord = {
      ...repository.loginRecord!,
      failedAttemptCount: 5,
      lockedUntil: new Date('2026-10-20T23:59:59.000Z'),
    }
    const { service } = createHarness(repository)

    await expect(service.login({ memberId, pin: syntheticPin })).resolves.toEqual(
      profile,
    )
    expect(repository.completeCalls).toEqual([memberId])
  })

  it('rejects when a concurrent request establishes a lock before reset', async () => {
    const repository = new FakeAuthRepository()
    repository.completeResult = false
    const { service } = createHarness(repository)

    await expect(
      service.login({ memberId, pin: syntheticPin }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it.each([
    { memberId: '', pin: syntheticPin, label: 'an empty member ID' },
    { memberId: 'not-a-uuid', pin: syntheticPin, label: 'a malformed member ID' },
    { memberId, pin: '12345', label: 'a short PIN' },
    { memberId, pin: '12345a', label: 'a nonnumeric PIN' },
    { memberId, pin: '１２３４５６', label: 'non-ASCII digits' },
  ])('rejects $label before repository access', async (input) => {
    const { repository, service, verificationCalls } = createHarness()

    await expect(service.login(input)).rejects.toBeInstanceOf(
      AuthValidationError,
    )
    expect(repository.findCalls).toEqual([])
    expect(verificationCalls).toEqual([])
  })

  it.each(['find', 'verify', 'record', 'complete'] as const)(
    'turns a %s dependency failure into a safe availability error',
    async (failurePoint) => {
      const repository = new FakeAuthRepository()
      const harness = createHarness(repository)

      if (failurePoint === 'find') {
        repository.findError = new Error('upstream secret detail')
      } else if (failurePoint === 'verify') {
        harness.setVerificationError(new Error('malformed secret hash'))
      } else if (failurePoint === 'record') {
        harness.setVerificationResult(false)
        repository.failureError = new Error('upstream secret detail')
      } else {
        repository.completeError = new Error('upstream secret detail')
      }

      const result = harness.service.login({ memberId, pin: syntheticPin })

      await expect(result).rejects.toBeInstanceOf(AuthUnavailableError)
      await expect(result).rejects.not.toThrow('secret')
    },
  )
})
