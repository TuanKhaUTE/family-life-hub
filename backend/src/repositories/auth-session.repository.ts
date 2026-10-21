import type { SupabaseClient } from '@supabase/supabase-js'

import { createSupabaseServerClient } from '../config/supabase.js'
import type {
  FamilyMemberRole,
  SafeFamilyProfile,
} from '../services/family-auth.service.js'

export interface NewAuthSession {
  memberId: string
  tokenHash: string
  expiresAt: Date
}

export interface AuthenticatedSessionRecord {
  sessionId: string
  profile: SafeFamilyProfile
}

export interface AuthSessionRepository {
  createSession(session: NewAuthSession): Promise<void>
  findAuthenticatedSession(
    tokenHash: string,
    now: Date,
  ): Promise<AuthenticatedSessionRecord | null>
  deleteByTokenHash(tokenHash: string): Promise<void>
}

interface FamilyProfileRow {
  id: string
  display_name: string
  role: FamilyMemberRole
  avatar_type: string | null
  avatar_value: string | null
  is_active: true
}

interface AuthenticatedSessionRow {
  id: string
  expires_at: string
  family_members: FamilyProfileRow
}

type SupabaseClientFactory = () => SupabaseClient

const FAMILY_MEMBER_ROLES = new Set<string>(['ADMIN', 'PARENT', 'MEMBER'])
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SESSION_COLUMNS =
  'id, expires_at, family_members!inner(id, display_name, role, avatar_type, avatar_value, is_active)'

export class AuthSessionDataError extends Error {
  constructor() {
    super('Unable to access authentication session')
    this.name = 'AuthSessionDataError'
  }
}

export class SupabaseAuthSessionRepository implements AuthSessionRepository {
  private client?: SupabaseClient

  constructor(
    private readonly clientFactory: SupabaseClientFactory =
      createSupabaseServerClient,
  ) {}

  async createSession(session: NewAuthSession): Promise<void> {
    const { error } = await this.getClient().from('auth_sessions').insert({
      member_id: session.memberId,
      token_hash: session.tokenHash,
      expires_at: session.expiresAt.toISOString(),
    })

    if (error) {
      throw new AuthSessionDataError()
    }
  }

  async findAuthenticatedSession(
    tokenHash: string,
    now: Date,
  ): Promise<AuthenticatedSessionRecord | null> {
    const { data, error } = await this.getClient()
      .from('auth_sessions')
      .select(SESSION_COLUMNS)
      .eq('token_hash', tokenHash)
      .gt('expires_at', now.toISOString())
      .eq('family_members.is_active', true)
      .maybeSingle()

    if (error) {
      throw new AuthSessionDataError()
    }

    if (data === null) {
      return null
    }

    if (!isAuthenticatedSessionRow(data, now)) {
      throw new AuthSessionDataError()
    }

    return {
      sessionId: data.id,
      profile: toSafeProfile(data.family_members),
    }
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    const { error } = await this.getClient()
      .from('auth_sessions')
      .delete()
      .eq('token_hash', tokenHash)

    if (error) {
      throw new AuthSessionDataError()
    }
  }

  private getClient(): SupabaseClient {
    this.client ??= this.clientFactory()
    return this.client
  }
}

function isAuthenticatedSessionRow(
  value: unknown,
  now: Date,
): value is AuthenticatedSessionRow {
  if (!value || typeof value !== 'object') {
    return false
  }

  const row = value as Record<string, unknown>

  return (
    typeof row.id === 'string' &&
    UUID_PATTERN.test(row.id) &&
    typeof row.expires_at === 'string' &&
    Date.parse(row.expires_at) > now.getTime() &&
    isFamilyProfileRow(row.family_members)
  )
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

function toSafeProfile(row: FamilyProfileRow): SafeFamilyProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    role: row.role,
    avatarType: row.avatar_type,
    avatarValue: row.avatar_value,
  }
}
