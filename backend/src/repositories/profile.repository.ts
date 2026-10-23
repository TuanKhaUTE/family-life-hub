import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '../config/supabase.js'
import { ApiError } from '../errors/api-error.js'
import type { AuthenticatedFamilySession } from '../services/family-session.service.js'
import type {
  ProfileRepository,
  ProfileInput,
} from '../services/profile.service.js'
import type { SafeFamilyProfile } from '../services/family-auth.service.js'
export const AVATAR_BUCKET = 'family-avatars'
export class SupabaseProfileRepository implements ProfileRepository {
  private client?: SupabaseClient
  constructor(private readonly factory = createSupabaseServerClient) {}
  private async rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await this.getClient().rpc(name, args)
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
    return this.updateProfile(auth, input)
  }
  async uploadAvatar(
    auth: AuthenticatedFamilySession,
    body: Buffer,
    cacheVersion: string,
  ) {
    const path = avatarPath(auth.profile.id)
    const { error } = await this.getClient()
      .storage.from(AVATAR_BUCKET)
      .upload(path, body as unknown as ArrayBuffer, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: true,
      })
    if (error) {
      throw new ApiError(
        503,
        'PROFILE_UNAVAILABLE',
        'Profile settings request could not be completed',
      )
    }
    try {
      return await this.updateProfile(auth, {
        displayName: auth.profile.displayName,
        avatarType: 'IMAGE',
        avatarValue: avatarRoute(auth.profile.id, cacheVersion),
      })
    } catch (error) {
      // Keep the owner-deterministic object when the profile RPC fails after
      // an upsert; the old profile reference remains owner-scoped and avoids
      // leaving an additional orphan path.
      if (auth.profile.avatarType !== 'IMAGE') {
        await this.removeAvatarObject(path)
      }
      throw error
    }
  }
  async deleteAvatar(auth: AuthenticatedFamilySession) {
    await this.removeAvatarObject(avatarPath(auth.profile.id))
  }
  publicAvatarUrl(memberId: string) {
    return this.getClient().storage.from(AVATAR_BUCKET).getPublicUrl(
      avatarPath(memberId),
    ).data.publicUrl
  }
  private async updateProfile(
    auth: AuthenticatedFamilySession,
    input: ProfileInput,
  ) {
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
  private async removeAvatarObject(path: string) {
    const { error } = await this.getClient()
      .storage.from(AVATAR_BUCKET)
      .remove([path])
    if (error) {
      throw new ApiError(
        503,
        'PROFILE_UNAVAILABLE',
        'Profile settings request could not be completed',
      )
    }
  }
  private getClient() {
    return (this.client ??= this.factory())
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

function avatarPath(memberId: string) {
  return `avatars/${memberId}/avatar.webp`
}

function avatarRoute(memberId: string, cacheVersion: string) {
  return `/api/profile/avatar/${memberId}?v=${encodeURIComponent(cacheVersion)}`
}
