import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '../config/supabase.js'
import { ApiError } from '../errors/api-error.js'
import {
  normalizeChore,
  type ChoreRepository,
  type ChoreOccurrence,
} from '../services/chore.service.js'
import {
  requireId,
  validDate,
  timestamp,
  type CalendarMember,
} from '../services/calendar.service.js'
export class SupabaseChoreRepository implements ChoreRepository {
  private client?: SupabaseClient
  constructor(
    private readonly factory: () => SupabaseClient = createSupabaseServerClient,
  ) {}
  private async rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await (this.client ??= this.factory()).rpc(
      name,
      args,
    )
    if (error?.code === '42501')
      throw new ApiError(
        403,
        'CHORE_FORBIDDEN',
        'Chore action is not permitted',
      )
    if (error?.code === 'P0002')
      throw new ApiError(404, 'CHORE_NOT_FOUND', 'Chore was not found')
    if (error?.code === 'P4001')
      throw new ApiError(
        409,
        'CHORE_CONFLICT',
        'Chore state has changed; reload before retrying',
      )
    if (
      error &&
      ['22023', '23514', '23503', '23502', '22P02', '23505'].includes(
        error.code,
      )
    )
      throw new ApiError(
        400,
        'CHORE_INVALID',
        'Invalid chore input or inactive assignee',
      )
    if (error) throw new Error('Chore storage unavailable')
    return data as unknown
  }
  async list(
    actorId: string,
    from: string,
    to: string,
    memberId: string | null,
  ) {
    const data = await this.rpc('chore_read', {
      p_actor_member_id: actorId,
      p_from: from,
      p_to: to,
      p_member_id: memberId,
    })
    try {
      if (
        !object(data) ||
        !Array.isArray(data.members) ||
        !Array.isArray(data.chores)
      )
        throw new Error()
      return {
        members: data.members.map(member),
        chores: data.chores.map(occurrence),
      }
    } catch {
      throw new Error('Invalid chore storage response')
    }
  }
  async save(
    actorId: string,
    scheduleId: string | null,
    input: Parameters<ChoreRepository['save']>[2],
  ) {
    const result = await this.rpc('chore_save', {
      p_actor_member_id: actorId,
      p_schedule_id: scheduleId,
      p_input: input,
    })
    try {
      requireId(result)
      return result
    } catch {
      throw new Error('Invalid chore identity')
    }
  }
  async cancelSchedule(actorId: string, id: string) {
    await this.rpc('chore_cancel_schedule', {
      p_actor_member_id: actorId,
      p_schedule_id: id,
    })
  }
  async cancelOccurrence(actorId: string, id: string, date: string) {
    await this.rpc('chore_set_occurrence', {
      p_actor_member_id: actorId,
      p_schedule_id: id,
      p_date: date,
      p_action: 'CANCEL',
    })
  }
  async complete(actorId: string, id: string, date: string) {
    await this.rpc('chore_set_occurrence', {
      p_actor_member_id: actorId,
      p_schedule_id: id,
      p_date: date,
      p_action: 'COMPLETE',
    })
  }
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function nullableText(value: unknown) {
  return value === null || typeof value === 'string'
}
function member(value: unknown): CalendarMember {
  if (
    !object(value) ||
    typeof value.displayName !== 'string' ||
    !nullableText(value.avatarType) ||
    !nullableText(value.avatarValue)
  )
    throw new Error()
  requireId(value.id)
  return {
    id: value.id,
    displayName: value.displayName,
    avatarType: value.avatarType as string | null,
    avatarValue: value.avatarValue as string | null,
  }
}
function occurrence(value: unknown): ChoreOccurrence {
  if (
    !object(value) ||
    !object(value.schedule) ||
    !validDate(value.date) ||
    !['PENDING', 'COMPLETED', 'CANCELLED'].includes(String(value.status)) ||
    (value.completedAt !== null && !timestamp(value.completedAt))
  )
    throw new Error()
  const s = value.schedule
  requireId(s.id)
  requireId(s.createdByMemberId)
  if (
    typeof s.cancelled !== 'boolean' ||
    !timestamp(s.createdAt) ||
    !timestamp(s.updatedAt)
  )
    throw new Error()
  const normalized = normalizeChore({
    requestId: s.requestId,
    title: s.title,
    category: s.category,
    scheduledDate: s.scheduledDate,
    scheduledTime: s.scheduledTime,
    assignedMemberId: s.assignedMemberId,
    weeklyAssignments: s.weeklyAssignments,
    recurrenceUntil: s.recurrenceUntil,
    note: s.note,
  })
  const assignee = member(value.assignee)
  if (value.completedByMemberId !== null) requireId(value.completedByMemberId)
  if (
    value.status === 'COMPLETED'
      ? value.completedAt === null || value.completedByMemberId !== assignee.id
      : value.completedAt !== null || value.completedByMemberId !== null
  )
    throw new Error()
  return {
    schedule: {
      ...normalized,
      id: s.id,
      createdByMemberId: s.createdByMemberId,
      cancelled: s.cancelled,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    },
    date: value.date,
    assignee,
    status: value.status as ChoreOccurrence['status'],
    completedAt: value.completedAt as string | null,
    completedByMemberId: value.completedByMemberId as string | null,
  }
}
