import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '../config/supabase.js'
import { ApiError } from '../errors/api-error.js'
import {
  requireId,
  timestamp,
  validDate,
  type CalendarMember,
} from '../services/calendar.service.js'
import type {
  DutyAssignment,
  DutyView,
  HouseholdDutyRepository,
} from '../services/household-duty.service.js'

export class SupabaseHouseholdDutyRepository implements HouseholdDutyRepository {
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
          'DUTY_FORBIDDEN',
          'This action is not permitted',
        )
      if (error.code === 'P4001')
        throw new ApiError(
          409,
          'DUTY_CONFLICT',
          'Duty state changed; reload before continuing',
        )
      if (error.code === 'P0002')
        throw new ApiError(404, 'DUTY_NOT_FOUND', 'Duty not found')
      if (['22023', '23514', '23503', '22P02'].includes(error.code))
        throw new ApiError(400, 'DUTY_INVALID', 'Invalid duty input')
      throw new Error('Duty storage unavailable')
    }
    return data as unknown
  }
  async list(actorId: string, from: string, to: string): Promise<DutyView> {
    const data = await this.rpc('household_duty_read', {
      p_actor_member_id: actorId,
      p_from: from,
      p_to: to,
    })
    if (
      !record(data) ||
      !Array.isArray(data.members) ||
      !Array.isArray(data.duties)
    )
      throw new Error('Invalid duty response')
    return {
      members: data.members.map(member),
      duties: data.duties.map((d) => {
        if (
          !record(d) ||
          !validDate(d.date) ||
          typeof d.cancelled !== 'boolean' ||
          (d.completedAt !== null && !timestamp(d.completedAt))
        )
          throw new Error('Invalid duty')
        requireId(d.id)
        if (d.completedByMemberId !== null) requireId(d.completedByMemberId)
        return {
          id: d.id,
          date: d.date,
          assignee: member(d.assignee),
          cancelled: d.cancelled,
          completedAt: d.completedAt as string | null,
          completedByMemberId: d.completedByMemberId as string | null,
        }
      }),
    }
  }
  async saveWeek(actorId: string, assignments: DutyAssignment[]) {
    await this.rpc('household_duty_save_week', {
      p_actor_member_id: actorId,
      p_assignments: assignments,
    })
  }
  async duplicateWeek(actorId: string, sourceWeek: string) {
    const data = await this.rpc('household_duty_duplicate_week', {
      p_actor_member_id: actorId,
      p_source_week: sourceWeek,
    })
    if (typeof data !== 'number' || !Number.isInteger(data) || data < 0)
      throw new Error('Invalid duty copy result')
    return data
  }
  async complete(actorId: string, date: string) {
    await this.rpc('household_duty_action', {
      p_actor_member_id: actorId,
      p_date: date,
      p_action: 'COMPLETE',
    })
  }
  async cancel(actorId: string, date: string) {
    await this.rpc('household_duty_action', {
      p_actor_member_id: actorId,
      p_date: date,
      p_action: 'CANCEL',
    })
  }
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function member(value: unknown): CalendarMember {
  if (
    !record(value) ||
    typeof value.displayName !== 'string' ||
    !(value.avatarType === null || typeof value.avatarType === 'string') ||
    !(value.avatarValue === null || typeof value.avatarValue === 'string')
  )
    throw new Error('Invalid member')
  requireId(value.id)
  return {
    id: value.id,
    displayName: value.displayName,
    avatarType: value.avatarType as string | null,
    avatarValue: value.avatarValue as string | null,
  }
}
