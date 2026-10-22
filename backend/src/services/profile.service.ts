import { ApiError } from '../errors/api-error.js'
import { hashPin, validatePin, verifyPin } from '../security/pin.js'
import type { AuthenticatedFamilySession } from './family-session.service.js'
import type {
  FamilyAuthRepository,
  SafeFamilyProfile,
} from './family-auth.service.js'
export const AVATAR_CHOICES = [
  { avatarType: 'EMOJI', avatarValue: '🌿', label: 'Chiếc lá' },
  { avatarType: 'EMOJI', avatarValue: '🌸', label: 'Hoa nhỏ' },
  { avatarType: 'EMOJI', avatarValue: '🐱', label: 'Mèo con' },
  { avatarType: 'EMOJI', avatarValue: '🐼', label: 'Gấu trúc' },
  { avatarType: 'EMOJI', avatarValue: '🦊', label: 'Cáo nhỏ' },
  { avatarType: 'EMOJI', avatarValue: '🌻', label: 'Hướng dương' },
  { avatarType: 'EMOJI', avatarValue: '📚', label: 'Sách' },
  { avatarType: 'EMOJI', avatarValue: '☀️', label: 'Nắng ấm' },
] as const
export interface ProfileInput {
  displayName: string
  avatarType: string | null
  avatarValue: string | null
}
export interface ProfileRepository {
  update(
    auth: AuthenticatedFamilySession,
    input: ProfileInput,
  ): Promise<SafeFamilyProfile>
  rotate(
    auth: AuthenticatedFamilySession,
    target: string,
    expectedHash: string,
    newHash: string,
    reset: boolean,
  ): Promise<void>
}
export class ProfileService {
  constructor(
    private readonly repository: ProfileRepository,
    private readonly credentials: FamilyAuthRepository,
    private readonly verifier = verifyPin,
    private readonly hasher = hashPin,
    private readonly clock = () => new Date(),
  ) {}
  summary(auth: AuthenticatedFamilySession) {
    return {
      profile: safeProfile(auth.profile),
      avatarChoices: AVATAR_CHOICES,
    }
  }
  async update(auth: AuthenticatedFamilySession, value: unknown) {
    if (
      !object(value) ||
      Object.keys(value).some(
        (k) => !['displayName', 'avatarType', 'avatarValue'].includes(k),
      ) ||
      typeof value.displayName !== 'string'
    )
      invalid()
    const name = value.displayName.trim()
    if (!name || Array.from(name).length > 100 || /\p{Cc}/u.test(name))
      invalid()
    const same =
      value.avatarType === auth.profile.avatarType &&
      value.avatarValue === auth.profile.avatarValue
    if (
      !same &&
      !(
        (value.avatarType === null && value.avatarValue === null) ||
        (value.avatarType === 'EMOJI' &&
          AVATAR_CHOICES.some((a) => a.avatarValue === value.avatarValue))
      )
    )
      invalid()
    return this.run(async () =>
      safeProfile(
        await this.repository.update(auth, {
          displayName: name,
          avatarType: value.avatarType as string | null,
          avatarValue: value.avatarValue as string | null,
        }),
      ),
    )
  }
  async members(auth: AuthenticatedFamilySession) {
    admin(auth)
    return this.run(async () =>
      (await this.credentials.listActiveProfiles())
        .filter((p) => p.id !== auth.profile.id)
        .map(safeProfile),
    )
  }
  async changePin(auth: AuthenticatedFamilySession, input: unknown) {
    const data = pinInput(input, false)
    await this.rotate(auth, auth.profile.id, data, false)
  }
  async resetPin(
    auth: AuthenticatedFamilySession,
    target: unknown,
    input: unknown,
  ) {
    admin(auth)
    if (
      typeof target !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        target,
      ) ||
      target.toLowerCase() === auth.profile.id.toLowerCase()
    )
      invalid()
    const data = pinInput(input, true)
    const members = await this.members(auth)
    if (!members.some((p) => p.id.toLowerCase() === target.toLowerCase()))
      throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Member not found')
    await this.rotate(auth, target, data, true)
  }
  private async rotate(
    auth: AuthenticatedFamilySession,
    target: string,
    input: { currentPin: string; newPin: string },
    reset: boolean,
  ) {
    await this.run(async () => {
      const credential = await this.credentials.findActiveLoginRecord(
        auth.profile.id,
      )
      if (
        !credential ||
        (credential.lockedUntil !== null &&
          credential.lockedUntil > this.clock())
      )
        rejected()
      if (!(await this.verifier(input.currentPin, credential.pinHash))) {
        await this.credentials.recordFailedLogin(
          auth.profile.id,
          credential.pinHash,
        )
        rejected()
      }
      const nextHash = await this.hasher(input.newPin)
      await this.repository.rotate(
        auth,
        target,
        credential.pinHash,
        nextHash,
        reset,
      )
    })
  }
  private async run<T>(op: () => Promise<T>) {
    try {
      return await op()
    } catch (e) {
      if (e instanceof ApiError) throw e
      throw new ApiError(
        503,
        'PROFILE_UNAVAILABLE',
        'Profile settings are temporarily unavailable',
      )
    }
  }
}
export function safeProfile(p: SafeFamilyProfile): SafeFamilyProfile {
  return {
    id: p.id,
    displayName: p.displayName,
    role: p.role,
    avatarType: p.avatarType,
    avatarValue: p.avatarValue,
  }
}
function pinInput(v: unknown, reset: boolean) {
  if (
    !object(v) ||
    Object.keys(v).some(
      (k) =>
        ![
          'currentPin',
          'newPin',
          'confirmation',
          ...(reset ? ['confirmReset'] : []),
        ].includes(k),
    ) ||
    typeof v.currentPin !== 'string' ||
    !/^\d{6}$/.test(v.currentPin) ||
    typeof v.newPin !== 'string' ||
    typeof v.confirmation !== 'string' ||
    (reset && v.confirmReset !== true)
  )
    invalid()
  try {
    validatePin(v.newPin, v.confirmation)
  } catch {
    invalid()
  }
  return { currentPin: v.currentPin, newPin: v.newPin }
}
function admin(auth: AuthenticatedFamilySession) {
  if (auth.profile.role !== 'ADMIN')
    throw new ApiError(
      403,
      'PROFILE_FORBIDDEN',
      'PIN recovery is not permitted',
    )
}
function object(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
function invalid(): never {
  throw new ApiError(400, 'PROFILE_INVALID', 'Invalid profile settings input')
}
function rejected(): never {
  throw new ApiError(401, 'PIN_REJECTED', 'Unable to verify current PIN')
}
