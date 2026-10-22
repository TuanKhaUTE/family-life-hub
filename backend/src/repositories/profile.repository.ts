import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '../config/supabase.js'
import { ApiError } from '../errors/api-error.js'
import type { AuthenticatedFamilySession } from '../services/family-session.service.js'
import type {
  ProfileRepository,
  ProfileInput,
} from '../services/profile.service.js'
import type { SafeFamilyProfile } from '../services/family-auth.service.js'
export class SupabaseProfileRepository implements ProfileRepository {
  private client?: SupabaseClient
  constructor(private readonly factory = createSupabaseServerClient) {}
  private async rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await (this.client ??= this.factory()).rpc(
      name,
      args,
    )
    if (error) {
      const status =
        error.code === '42501'
          ? 403
          : error.code === '28000'
            ? 401
            : error.code === 'P0002'
              ? 404
              : ['22023', '23514', '23502'].includes(error.code)
                ? 400
                : 503
      throw new ApiError(
        status,
        status === 401 ? 'PIN_REJECTED' : 'PROFILE_UNAVAILABLE',
        'Profile settings request could not be completed',
      )
    }
    return data as unknown
  }
  async update(auth: AuthenticatedFamilySession, input: ProfileInput) {
    const p = await this.rpc('update_own_family_profile', {
      p_actor_member_id: auth.profile.id,
      p_session_id: auth.sessionId,
      p_input: input,
    })
    if (!p || typeof p !== 'object' || Array.isArray(p))
      throw new Error('Invalid profile response')
    const v = p as Record<string, unknown>
    if (
      v.id !== auth.profile.id ||
      v.role !== auth.profile.role ||
      typeof v.displayName !== 'string' ||
      !(v.avatarType === null || typeof v.avatarType === 'string') ||
      !(v.avatarValue === null || typeof v.avatarValue === 'string')
    )
      throw new Error('Invalid profile response')
    return {
      id: v.id as string,
      role: v.role as SafeFamilyProfile['role'],
      displayName: v.displayName,
      avatarType: v.avatarType as string | null,
      avatarValue: v.avatarValue as string | null,
    }
  }
  async rotate(
    auth: AuthenticatedFamilySession,
    target: string,
    expectedHash: string,
    newHash: string,
    reset: boolean,
  ) {
    await this.rpc('rotate_family_pin', {
      p_actor_member_id: auth.profile.id,
      p_session_id: auth.sessionId,
      p_target_member_id: target,
      p_expected_pin_hash: expectedHash,
      p_new_pin_hash: newHash,
      p_reset: reset,
    })
  }
}
