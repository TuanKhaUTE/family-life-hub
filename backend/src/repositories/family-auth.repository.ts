import type { SupabaseClient } from '@supabase/supabase-js'

import { createSupabaseServerClient } from '../config/supabase.js'
import type {
  FamilyAuthRepository,
  FamilyLoginRecord,
  FamilyMemberRole,
  SafeFamilyProfile,
} from '../services/family-auth.service.js'

interface FamilyProfileRow {
  id: string
  display_name: string
  role: FamilyMemberRole
  avatar_type: string | null
  avatar_value: string | null
  is_active: true
}

interface FamilyLoginRow {
  pin_hash: string
  failed_attempt_count: number
  locked_until: string | null
  family_members: FamilyProfileRow
}

type SupabaseClientFactory = () => SupabaseClient

const FAMILY_MEMBER_ROLES = new Set<string>(['ADMIN', 'PARENT', 'MEMBER'])
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PROFILE_COLUMNS =
  'id, display_name, role, avatar_type, avatar_value, is_active'
const LOGIN_COLUMNS =
  'pin_hash, failed_attempt_count, locked_until, family_members!inner(id, display_name, role, avatar_type, avatar_value, is_active)'

export class FamilyAuthDataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FamilyAuthDataError'
  }
}

export class SupabaseFamilyAuthRepository implements FamilyAuthRepository {
  private client?: SupabaseClient

  constructor(
    private readonly clientFactory: SupabaseClientFactory =
      createSupabaseServerClient,
  ) {}

  async listActiveProfiles(): Promise<SafeFamilyProfile[]> {
    const { data, error } = await this.getClient()
      .from('family_members')
      .select(PROFILE_COLUMNS)
      .eq('is_active', true)
      .order('display_name', { ascending: true })
      .order('id', { ascending: true })

    if (error || !Array.isArray(data) || !data.every(isFamilyProfileRow)) {
      throw new FamilyAuthDataError('Unable to load family profiles')
    }

    return data.map(toSafeProfile)
  }

  async findActiveLoginRecord(
    memberId: string,
  ): Promise<FamilyLoginRecord | null> {
    const { data, error } = await this.getClient()
      .from('auth_credentials')
      .select(LOGIN_COLUMNS)
      .eq('member_id', memberId)
      .eq('family_members.is_active', true)
      .maybeSingle()

    if (error) {
      throw new FamilyAuthDataError('Unable to load login credential')
    }

    if (data === null) {
      return null
    }

    if (!isFamilyLoginRow(data)) {
      throw new FamilyAuthDataError('Unable to load login credential')
    }

    return {
      profile: toSafeProfile(data.family_members),
      pinHash: data.pin_hash,
      failedAttemptCount: data.failed_attempt_count,
      lockedUntil:
        data.locked_until === null ? null : new Date(data.locked_until),
    }
  }

  async recordFailedLogin(memberId: string): Promise<void> {
    const { data, error } = await this.getClient().rpc(
      'record_failed_pin_login',
      { p_member_id: memberId },
    )

    if (error || typeof data !== 'boolean') {
      throw new FamilyAuthDataError('Unable to record login attempt')
    }
  }

  async completeSuccessfulLogin(memberId: string): Promise<boolean> {
    const { data, error } = await this.getClient().rpc(
      'complete_successful_pin_login',
      { p_member_id: memberId },
    )

    if (error || typeof data !== 'boolean') {
      throw new FamilyAuthDataError('Unable to complete login attempt')
    }

    return data
  }

  private getClient(): SupabaseClient {
    this.client ??= this.clientFactory()
    return this.client
  }
}

function isFamilyProfileRow(value: unknown): value is FamilyProfileRow {
  if (!value || typeof value !== 'object') {
    return false
  }

  const row = value as Record<string, unknown>
  const validAvatar =
    (row.avatar_type === null && row.avatar_value === null) ||
    (typeof row.avatar_type === 'string' &&
      typeof row.avatar_value === 'string')

  return (
    typeof row.id === 'string' &&
    UUID_PATTERN.test(row.id) &&
    typeof row.display_name === 'string' &&
    typeof row.role === 'string' &&
    FAMILY_MEMBER_ROLES.has(row.role) &&
    validAvatar &&
    row.is_active === true
  )
}

function isFamilyLoginRow(value: unknown): value is FamilyLoginRow {
  if (!value || typeof value !== 'object') {
    return false
  }

  const row = value as Record<string, unknown>
  const validLockedUntil =
    row.locked_until === null ||
    (typeof row.locked_until === 'string' &&
      !Number.isNaN(Date.parse(row.locked_until)))

  return (
    typeof row.pin_hash === 'string' &&
    row.pin_hash.length >= 20 &&
    Number.isInteger(row.failed_attempt_count) &&
    Number(row.failed_attempt_count) >= 0 &&
    validLockedUntil &&
    isFamilyProfileRow(row.family_members)
  )
}

function toSafeProfile(row: FamilyProfileRow): SafeFamilyProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    role: row.role,
    avatarType: row.avatar_type,
    avatarValue: row.avatar_value,
  }
}
