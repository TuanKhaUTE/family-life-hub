import { describe, expect, it } from 'vitest'

import {
  BootstrapValidationError,
  FamilyMemberBootstrapService,
  type CreateFamilyMemberRecord,
  type FamilyMemberBootstrapRepository,
  type FamilyMemberSummary,
} from '../src/services/family-member-bootstrap.service.js'
import { PinValidationError } from '../src/security/pin.js'

const syntheticPin = '123456'
const syntheticHash = '$argon2id$synthetic-test-hash-value'

class FakeRepository implements FamilyMemberBootstrapRepository {
  summaries: FamilyMemberSummary[] = []
  createdRecords: CreateFamilyMemberRecord[] = []
  listError?: Error
  createError?: Error

  async listMemberSummaries(): Promise<FamilyMemberSummary[]> {
    if (this.listError) {
      throw this.listError
    }

    return this.summaries
  }

  async createWithCredential(
    input: CreateFamilyMemberRecord,
  ): Promise<string> {
    if (this.createError) {
      throw this.createError
    }

    this.createdRecords.push(input)
    return '11111111-1111-4111-8111-111111111111'
  }
}

function createService(repository = new FakeRepository()) {
  const hashedPins: string[] = []
  const service = new FamilyMemberBootstrapService(
    repository,
    async (pin) => {
      hashedPins.push(pin)
      return syntheticHash
    },
  )

  return { service, repository, hashedPins }
}

describe('FamilyMemberBootstrapService.create', () => {
  it('normalizes valid profile input and sends only the hash to the repository', async () => {
    const { service, repository, hashedPins } = createService()

    const memberId = await service.create({
      displayName: '  Synthetic Member  ',
      role: 'MEMBER',
      avatarType: '  PRESET  ',
      avatarValue: '  avatar-one  ',
      pin: syntheticPin,
      pinConfirmation: syntheticPin,
    })

    expect(memberId).toBe('11111111-1111-4111-8111-111111111111')
    expect(hashedPins).toEqual([syntheticPin])
    expect(repository.createdRecords).toEqual([
      {
        displayName: 'Synthetic Member',
        role: 'MEMBER',
        avatarType: 'PRESET',
        avatarValue: 'avatar-one',
        pinHash: syntheticHash,
      },
    ])
    expect(repository.createdRecords[0]).not.toHaveProperty('pin')
  })

  it('normalizes an omitted avatar to null fields', async () => {
    const { service, repository } = createService()

    await service.create({
      displayName: 'Synthetic Member',
      role: 'ADMIN',
      pin: syntheticPin,
      pinConfirmation: syntheticPin,
    })

    expect(repository.createdRecords[0]).toMatchObject({
      avatarType: null,
      avatarValue: null,
    })
  })

  it.each([
    { displayName: '', label: 'an empty display name' },
    { displayName: ' '.repeat(4), label: 'a whitespace-only display name' },
    { displayName: 'a'.repeat(101), label: 'a display name over 100 characters' },
    { displayName: 'Unsafe\nName', label: 'a display name with a control character' },
  ])('rejects $label before hashing or writing', async ({ displayName }) => {
    const { service, repository, hashedPins } = createService()

    await expect(
      service.create({
        displayName,
        role: 'MEMBER',
        pin: syntheticPin,
        pinConfirmation: syntheticPin,
      }),
    ).rejects.toBeInstanceOf(BootstrapValidationError)
    expect(hashedPins).toEqual([])
    expect(repository.createdRecords).toEqual([])
  })

  it('rejects an unsupported role before hashing or writing', async () => {
    const { service, repository, hashedPins } = createService()

    await expect(
      service.create({
        displayName: 'Synthetic Member',
        role: 'OWNER',
        pin: syntheticPin,
        pinConfirmation: syntheticPin,
      }),
    ).rejects.toBeInstanceOf(BootstrapValidationError)
    expect(hashedPins).toEqual([])
    expect(repository.createdRecords).toEqual([])
  })

  it.each([
    { avatarType: 'PRESET', avatarValue: undefined, label: 'a missing avatar value' },
    { avatarType: undefined, avatarValue: 'avatar-one', label: 'a missing avatar type' },
    { avatarType: '  ', avatarValue: 'avatar-one', label: 'a blank avatar type' },
    { avatarType: 'PRESET', avatarValue: 'bad\u0000value', label: 'an unsafe avatar value' },
  ])('rejects $label before hashing or writing', async ({ avatarType, avatarValue }) => {
    const { service, repository, hashedPins } = createService()

    await expect(
      service.create({
        displayName: 'Synthetic Member',
        role: 'MEMBER',
        avatarType,
        avatarValue,
        pin: syntheticPin,
        pinConfirmation: syntheticPin,
      }),
    ).rejects.toBeInstanceOf(BootstrapValidationError)
    expect(hashedPins).toEqual([])
    expect(repository.createdRecords).toEqual([])
  })

  it('rejects an invalid PIN before hashing or writing', async () => {
    const { service, repository, hashedPins } = createService()

    await expect(
      service.create({
        displayName: 'Synthetic Member',
        role: 'MEMBER',
        pin: syntheticPin,
        pinConfirmation: '654321',
      }),
    ).rejects.toBeInstanceOf(PinValidationError)
    expect(hashedPins).toEqual([])
    expect(repository.createdRecords).toEqual([])
  })

  it('propagates hashing failures without writing', async () => {
    const repository = new FakeRepository()
    const service = new FamilyMemberBootstrapService(repository, async () => {
      throw new Error('hashing unavailable')
    })

    await expect(
      service.create({
        displayName: 'Synthetic Member',
        role: 'MEMBER',
        pin: syntheticPin,
        pinConfirmation: syntheticPin,
      }),
    ).rejects.toThrow('hashing unavailable')
    expect(repository.createdRecords).toEqual([])
  })

  it('propagates creation failures', async () => {
    const repository = new FakeRepository()
    repository.createError = new Error('creation unavailable')
    const { service } = createService(repository)

    await expect(
      service.create({
        displayName: 'Synthetic Member',
        role: 'MEMBER',
        pin: syntheticPin,
        pinConfirmation: syntheticPin,
      }),
    ).rejects.toThrow('creation unavailable')
  })
})

describe('FamilyMemberBootstrapService.findDisplayNameMatches', () => {
  it('matches trimmed names case-insensitively and treats wildcard characters literally', async () => {
    const { service, repository, hashedPins } = createService()
    repository.summaries = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        displayName: 'Existing Member',
        role: 'MEMBER',
        isActive: true,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        displayName: '50%_Ready',
        role: 'ADMIN',
        isActive: true,
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        displayName: '500XReady',
        role: 'PARENT',
        isActive: true,
      },
    ]

    await expect(
      service.findDisplayNameMatches('  existing MEMBER  '),
    ).resolves.toEqual([repository.summaries[0]])
    await expect(service.findDisplayNameMatches('50%_ready')).resolves.toEqual([
      repository.summaries[1],
    ])
    expect(hashedPins).toEqual([])
    expect(repository.createdRecords).toEqual([])
  })

  it('propagates preflight failures', async () => {
    const { service, repository } = createService()
    repository.listError = new Error('preflight unavailable')

    await expect(
      service.findDisplayNameMatches('Synthetic Member'),
    ).rejects.toThrow('preflight unavailable')
  })
})
