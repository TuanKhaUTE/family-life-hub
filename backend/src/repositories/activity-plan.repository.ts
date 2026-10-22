import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '../config/supabase.js'
import { ApiError } from '../errors/api-error.js'
import { requireId, timestamp, validDate } from '../services/calendar.service.js'
import type { ActivityKind, ActivityPlan, ActivityPlanInput, ActivityPlanRepository } from '../services/activity-plan.service.js'
export class SupabaseActivityPlanRepository implements ActivityPlanRepository {
  private client?: SupabaseClient
  constructor(private readonly factory: () => SupabaseClient = createSupabaseServerClient) {}
  private async rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await (this.client ??= this.factory()).rpc(name, args)
    if (error) {
      if (error.code === '42501') throw new ApiError(403, 'ACTIVITY_FORBIDDEN', 'Private activity access denied')
      if (error.code === 'P0002') throw new ApiError(404, 'ACTIVITY_NOT_FOUND', 'Activity was not found')
      if (['P5001','23503','23505'].includes(error.code)) throw new ApiError(409, 'ACTIVITY_CONFLICT', 'Activity changed; reload before continuing')
      if (['22023','23514','22P02','23502'].includes(error.code)) throw new ApiError(400, 'ACTIVITY_INVALID', 'Invalid activity input')
      throw new Error('Activity storage unavailable')
    }
    return data as unknown
  }
  async read(actorId: string, kind: ActivityKind, id: string | null = null) {
    const value = await this.rpc('activity_plan_read', { p_actor_member_id: actorId, p_kind: kind, p_id: id })
    if (!object(value) || !Array.isArray(value.plans) || !Array.isArray(value.facts) || !Array.isArray(value.schedule)) throw new Error('Invalid activity response')
    return {
      plans: value.plans.map(v => {
        if (!object(v) || v.kind !== kind || typeof v.title !== 'string' || !timestamp(v.startsAt) || !timestamp(v.endsAt) || !nullable(v.note) || !nullable(v.completionNote) || !(v.completedAt === null || timestamp(v.completedAt)) || !(v.actualMinutes === null || count(v.actualMinutes)) || typeof v.cancelled !== 'boolean') throw new Error('Invalid activity plan')
        requireId(v.id); if (v.courseId !== null) requireId(v.courseId)
        return { id: v.id, requestId: v.id, kind, title: v.title, startsAt: v.startsAt, endsAt: v.endsAt, courseId: v.courseId as string | null, note: v.note as string | null, completedAt: v.completedAt as string | null, actualMinutes: v.actualMinutes as number | null, completionNote: v.completionNote as string | null, cancelled: v.cancelled } satisfies ActivityPlan
      }),
      facts: value.facts.map(f => { if (!object(f) || !validDate(f.date) || !(f.minutes === null || count(f.minutes))) throw new Error('Invalid completion fact'); return { date: f.date, minutes: f.minutes as number | null } }),
      schedule: value.schedule.map(s => { if (!object(s) || !timestamp(s.endsAt) || !(s.completedAt === null || timestamp(s.completedAt)) || typeof s.cancelled !== 'boolean') throw new Error('Invalid schedule fact'); requireId(s.id); return { id: s.id, endsAt: s.endsAt, completedAt: s.completedAt as string | null, cancelled: s.cancelled } }),
    }
  }
  async save(actorId: string, kind: ActivityKind, id: string | null, input: ActivityPlanInput) { const result = await this.rpc('activity_plan_save', { p_actor_member_id: actorId, p_kind: kind, p_id: id, p_input: input }); requireId(result); return result }
  async complete(actorId: string, id: string, input: { durationMinutes: number; note: string | null }, correct: boolean) { await this.rpc('activity_plan_complete', { p_actor_member_id: actorId, p_id: id, p_minutes: input.durationMinutes, p_note: input.note, p_correct: correct }) }
  async cancel(actorId: string, id: string) { await this.rpc('activity_plan_cancel', { p_actor_member_id: actorId, p_id: id }) }
}
function object(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v) }
function nullable(v: unknown) { return v === null || typeof v === 'string' }
function count(v: unknown): v is number { return Number.isSafeInteger(v) && (v as number) >= 0 }
