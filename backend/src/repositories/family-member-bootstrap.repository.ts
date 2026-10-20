import type { SupabaseClient } from '@supabase/supabase-js'

import { createSupabaseServerClient } from '../config/supabase.js'
import type {
  CreateFamilyMemberRecord,
  FamilyMemberBootstrapRepository,
  FamilyMemberRole,
  FamilyMemberSummary,
} from '../services/family-member-bootstrap.service.js'

interface FamilyMemberRow {
  id: string
  display_name: string
  role: FamilyMemberRole
  is_active: boolean
}

const FAMILY_MEMBER_ROLES = new Set<string>(['ADMIN', 'PARENT', 'MEMBER'])
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class FamilyMemberBootstrapDataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FamilyMemberBootstrapDataError'
  }
}

export class SupabaseFamilyMemberBootstrapRepository
  implements FamilyMemberBootstrapRepository
{
  constructor(
    private readonly client: SupabaseClient = createSupabaseServerClient(),
  ) {}

  async listMemberSummaries(): Promise<FamilyMemberSummary[]> {
    const { data, error } = await this.client
      .from('family_members')
      .select('id, display_name, role, is_active')

    if (error || !Array.isArray(data) || !data.every(isFamilyMemberRow)) {
      throw new FamilyMemberBootstrapDataError(
        'Unable to check existing family members',
      )
    }

    return data.map((member) => ({
      id: member.id,
      displayName: member.display_name,
      role: member.role,
      isActive: member.is_active,
    }))
  }

  async createWithCredential(
    input: CreateFamilyMemberRecord,
  ): Promise<string> {
    const { data, error } = await this.client.rpc('bootstrap_family_member', {
      p_display_name: input.displayName,
      p_role: input.role,
      p_avatar_type: input.avatarType,
      p_avatar_value: input.avatarValue,
      p_pin_hash: input.pinHash,
    })

    if (error || typeof data !== 'string' || !UUID_PATTERN.test(data)) {
      throw new FamilyMemberBootstrapDataError(
        'Family member creation could not be confirmed',
      )
    }

    return data
  }
}

function isFamilyMemberRow(value: unknown): value is FamilyMemberRow {
  if (!value || typeof value !== 'object') {
    return false
  }

  const row = value as Record<string, unknown>

  return (
    typeof row.id === 'string' &&
    UUID_PATTERN.test(row.id) &&
    typeof row.display_name === 'string' &&
    typeof row.role === 'string' &&
    FAMILY_MEMBER_ROLES.has(row.role) &&
    typeof row.is_active === 'boolean'
  )
}
