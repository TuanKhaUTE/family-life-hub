import { hashPin, validatePin } from '../security/pin.js'

export type FamilyMemberRole = 'ADMIN' | 'PARENT' | 'MEMBER'

export interface FamilyMemberSummary {
  id: string
  displayName: string
  role: FamilyMemberRole
  isActive: boolean
}

export interface BootstrapProfileInput {
  displayName: string
  role: string
  avatarType?: string | null
  avatarValue?: string | null
}

export interface BootstrapFamilyMemberInput extends BootstrapProfileInput {
  pin: string
  pinConfirmation: string
}

export interface CreateFamilyMemberRecord {
  displayName: string
  role: FamilyMemberRole
  avatarType: string | null
  avatarValue: string | null
  pinHash: string
}

export interface FamilyMemberBootstrapRepository {
  listMemberSummaries(): Promise<FamilyMemberSummary[]>
  createWithCredential(input: CreateFamilyMemberRecord): Promise<string>
}

interface NormalizedProfile {
  displayName: string
  role: FamilyMemberRole
  avatarType: string | null
  avatarValue: string | null
}

type PinHasher = (pin: string) => Promise<string>

const FAMILY_MEMBER_ROLES = new Set<string>(['ADMIN', 'PARENT', 'MEMBER'])
const CONTROL_CHARACTER = /\p{Cc}/u

export class BootstrapValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BootstrapValidationError'
  }
}

export class FamilyMemberBootstrapService {
  constructor(
    private readonly repository: FamilyMemberBootstrapRepository,
    private readonly pinHasher: PinHasher = hashPin,
  ) {}

  async findDisplayNameMatches(
    displayName: string,
  ): Promise<FamilyMemberSummary[]> {
    const normalizedName = normalizeDisplayName(displayName)
    const comparisonName = normalizedName.toLowerCase()
    const members = await this.repository.listMemberSummaries()

    return members.filter(
      (member) => member.displayName.trim().toLowerCase() === comparisonName,
    )
  }

  async create(input: BootstrapFamilyMemberInput): Promise<string> {
    const profile = normalizeProfile(input)
    validatePin(input.pin, input.pinConfirmation)
    const pinHash = await this.pinHasher(input.pin)

    return this.repository.createWithCredential({
      ...profile,
      pinHash,
    })
  }
}

function normalizeProfile(input: BootstrapProfileInput): NormalizedProfile {
  return {
    displayName: normalizeDisplayName(input.displayName),
    role: normalizeRole(input.role),
    ...normalizeAvatar(input.avatarType, input.avatarValue),
  }
}

function normalizeDisplayName(displayName: string): string {
  const normalized = displayName.trim()
  const characterCount = Array.from(normalized).length

  if (
    characterCount === 0 ||
    characterCount > 100 ||
    CONTROL_CHARACTER.test(normalized)
  ) {
    throw new BootstrapValidationError(
      'Display name must contain 1 to 100 characters without control characters',
    )
  }

  return normalized
}

function normalizeRole(role: string): FamilyMemberRole {
  if (!FAMILY_MEMBER_ROLES.has(role)) {
    throw new BootstrapValidationError('Role must be ADMIN, PARENT, or MEMBER')
  }

  return role as FamilyMemberRole
}

function normalizeAvatar(
  avatarType: string | null | undefined,
  avatarValue: string | null | undefined,
): Pick<NormalizedProfile, 'avatarType' | 'avatarValue'> {
  const hasType = avatarType !== null && avatarType !== undefined
  const hasValue = avatarValue !== null && avatarValue !== undefined

  if (!hasType && !hasValue) {
    return { avatarType: null, avatarValue: null }
  }

  if (!hasType || !hasValue) {
    throw new BootstrapValidationError(
      'Avatar type and value must be provided together',
    )
  }

  const normalizedType = avatarType.trim()
  const normalizedValue = avatarValue.trim()

  if (
    normalizedType.length === 0 ||
    normalizedValue.length === 0 ||
    CONTROL_CHARACTER.test(normalizedType) ||
    CONTROL_CHARACTER.test(normalizedValue)
  ) {
    throw new BootstrapValidationError(
      'Avatar type and value must be nonblank and contain no control characters',
    )
  }

  return { avatarType: normalizedType, avatarValue: normalizedValue }
}
