import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '../config/supabase.js'
import { ApiError } from '../errors/api-error.js'
import {
  normalizeCalendarInput,
  requireId,
  timestamp,
  validDate,
  type CalendarRepository,
  type CalendarMember,
  type CalendarOccurrence,
  type CalendarEvent,
} from '../services/calendar.service.js'

export class SupabaseCalendarRepository implements CalendarRepository {
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
        'CALENDAR_FORBIDDEN',
        'Only the active owner can change this calendar event',
      )
    if (error?.code === 'P0002')
      throw new ApiError(
        404,
        'CALENDAR_NOT_FOUND',
        'Calendar event was not found',
      )
    if (error?.code === 'P3001')
      throw new ApiError(
        409,
        'CALENDAR_EXCEPTIONS_EXIST',
        'Edit individual occurrences when this series has exceptions',
      )
    if (error && ['22023', '23514', '23503'].includes(error.code))
      throw new ApiError(400, 'CALENDAR_INVALID', 'Invalid calendar input')
    if (error) throw new Error('Calendar storage unavailable')
    return data as unknown
  }
  async list(
    actorId: string,
    from: string,
    to: string,
    memberId: string | null,
  ) {
    const data = await this.rpc('calendar_read', {
      p_actor_member_id: actorId,
      p_from: from,
      p_to: to,
      p_owner_member_id: memberId,
    })
    try {
      if (
        !object(data) ||
        !Array.isArray(data.members) ||
        !Array.isArray(data.occurrences)
      )
        throw new Error()
      return {
        members: data.members.map(member),
        occurrences: data.occurrences.map(occurrence),
      }
    } catch {
      throw new Error('Invalid calendar storage response')
    }
  }
  async save(
    actorId: string,
    eventId: string | null,
    input: Parameters<CalendarRepository['save']>[2],
  ) {
    const data = await this.rpc('calendar_save_event', {
      p_actor_member_id: actorId,
      p_event_id: eventId,
      p_title: input.title,
      p_category: input.category,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
      p_note: input.note,
      p_weekdays: input.weekdays,
      p_recurrence_until: input.recurrenceUntil,
    })
    try {
      requireId(data)
      return data
    } catch {
      throw new Error('Invalid calendar event identity')
    }
  }
  async remove(actorId: string, eventId: string) {
    await this.rpc('calendar_delete_event', {
      p_actor_member_id: actorId,
      p_event_id: eventId,
    })
  }
  async exception(
    actorId: string,
    eventId: string,
    date: string,
    input: Parameters<CalendarRepository['exception']>[3],
  ) {
    await this.rpc('calendar_save_exception', {
      p_actor_member_id: actorId,
      p_event_id: eventId,
      p_occurrence_date: date,
      p_cancelled: input.cancelled,
      p_title: input.title,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
      p_note: input.note,
    })
  }
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
function occurrence(value: unknown): CalendarOccurrence {
  if (
    !object(value) ||
    !object(value.event) ||
    !validDate(value.date) ||
    typeof value.title !== 'string' ||
    !timestamp(value.startsAt) ||
    !timestamp(value.endsAt) ||
    !nullableText(value.note) ||
    typeof value.cancelled !== 'boolean' ||
    typeof value.isException !== 'boolean'
  )
    throw new Error()
  const e = value.event
  requireId(e.id)
  requireId(e.ownerMemberId)
  if (!timestamp(e.createdAt) || !timestamp(e.updatedAt)) throw new Error()
  const input = normalizeCalendarInput({
    title: e.title,
    category: e.category,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    note: e.note,
    weekdays: e.weekdays,
    recurrenceUntil: e.recurrenceUntil,
  })
  const event: CalendarEvent = {
    id: e.id,
    ownerMemberId: e.ownerMemberId,
    ...input,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }
  const owner = member(value.owner)
  if (owner.id !== event.ownerMemberId) throw new Error()
  return {
    event,
    owner,
    date: value.date,
    title: value.title,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    note: value.note as string | null,
    cancelled: value.cancelled,
    isException: value.isException,
  }
}
function nullableText(value: unknown) {
  return value === null || typeof value === 'string'
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
