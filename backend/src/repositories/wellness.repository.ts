import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '../config/supabase.js'
import { ApiError } from '../errors/api-error.js'
import {
  normalizeWellnessProfile,
  normalizeWeight,
  wellnessId,
  type WellnessRepository,
  type WellnessData,
  type WellnessProfile,
  type WeightInput,
} from '../services/wellness.service.js'

export class SupabaseWellnessRepository implements WellnessRepository {
  private client?: SupabaseClient
  constructor(
    private readonly factory: () => SupabaseClient = createSupabaseServerClient,
  ) {}
  private async rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await (this.client ??= this.factory()).rpc(
      name,
      args,
    )
    if (error) {
      if (error.code === '42501')
        throw new ApiError(
          403,
          'WELLNESS_FORBIDDEN',
          'Wellness access is not permitted',
        )
      if (error.code === 'P0002')
        throw new ApiError(
          404,
          'WELLNESS_NOT_FOUND',
          'Wellness record not found',
        )
      if (error.code === '23505')
        throw new ApiError(
          409,
          'WELLNESS_DATE_EXISTS',
          'A weight log already exists for this date',
        )
      if (
        ['22023', '23514', '23502', '22P02', '22007', '22008'].includes(
          error.code,
        )
      )
        throw new ApiError(400, 'WELLNESS_INVALID', 'Invalid Wellness input')
      throw new Error('Wellness storage unavailable')
    }
    return data as unknown
  }
  async read(actorId: string, today: string): Promise<WellnessData> {
    const data = await this.rpc('wellness_read', {
      p_actor_member_id: actorId,
      p_today: today,
    })
    try {
      if (!object(data) || !Array.isArray(data.logs) || data.logs.length > 31)
        throw new Error()
      let profile: WellnessProfile | null = null
      if (data.profile !== null) {
        if (!object(data.profile)) throw new Error()
        profile = normalizeWellnessProfile({
          heightCm: data.profile.heightCm,
          targetWeightKg: data.profile.targetWeightKg,
          activityLevel: data.profile.activityLevel,
        })
      }
      const logs = data.logs
        .map((row) => {
          if (!object(row)) throw new Error()
          wellnessId(row.id)
          return {
            id: row.id,
            ...normalizeWeight(
              {
                loggedDate: row.loggedDate,
                weightKg: row.weightKg,
                note: row.note,
              },
              today,
            ),
          }
        })
        .sort((a, b) => b.loggedDate.localeCompare(a.loggedDate))
      if (new Set(logs.map((log) => log.loggedDate)).size !== logs.length)
        throw new Error()
      return { profile, logs }
    } catch {
      throw new Error('Invalid Wellness storage response')
    }
  }
  async mutate(
    actorId: string,
    kind: 'profile' | 'logs',
    id: string | null,
    input: WellnessProfile | WeightInput | null,
    remove: boolean,
  ) {
    await this.rpc('wellness_mutate', {
      p_actor_member_id: actorId,
      p_kind: kind,
      p_id: id,
      p_input: input,
      p_remove: remove,
    })
  }
}
function object(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
