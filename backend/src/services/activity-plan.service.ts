import { ApiError } from '../errors/api-error.js'
import type { SafeFamilyProfile } from './family-auth.service.js'
import { getFamilyDate } from '../time/family-calendar.js'
import { requireId, timestamp } from './calendar.service.js'
import { activityProgress, type CompletionFact, type ScheduleFact } from './activity-progress.js'
export type ActivityKind = 'STUDY' | 'FITNESS'
export interface ActivityPlanInput { requestId: string; title: string; startsAt: string; endsAt: string; courseId: string | null; note: string | null }
export interface ActivityPlan extends ActivityPlanInput { id: string; kind: ActivityKind; completedAt: string | null; actualMinutes: number | null; completionNote: string | null; cancelled: boolean }
export interface ActivityPlanRepository {
  read(actorId: string, kind: ActivityKind, id?: string | null): Promise<{ plans: ActivityPlan[]; facts: CompletionFact[]; schedule: ScheduleFact[] }>
  save(actorId: string, kind: ActivityKind, id: string | null, input: ActivityPlanInput): Promise<string>
  complete(actorId: string, id: string, input: { durationMinutes: number; note: string | null }, correct: boolean): Promise<void>
  cancel(actorId: string, id: string): Promise<void>
}
export class ActivityPlanService {
  constructor(private readonly repository: ActivityPlanRepository, private readonly clock = () => new Date()) {}
  async read(actor: SafeFamilyProfile, kind: unknown, id: unknown = null) {
    allowed(actor); const k = kindValue(kind)
    if (id !== null) requireId(id)
    return this.run(async () => {
      const data = await this.repository.read(actor.id, k, id as string | null)
      if (id !== null && !data.plans.length) throw new ApiError(404, 'ACTIVITY_NOT_FOUND', 'Activity was not found')
      return { plans: data.plans, progress: activityProgress(getFamilyDate(this.clock()), data.facts, data.schedule, this.clock()) }
    })
  }
  async progress(actor: SafeFamilyProfile, kind: ActivityKind) { return (await this.read(actor, kind)).progress }
  async save(actor: SafeFamilyProfile, kind: unknown, id: unknown, value: unknown) {
    allowed(actor); const k = kindValue(kind)
    if (id !== null) requireId(id)
    if (!object(value) || !only(value, ['requestId', 'title', 'startsAt', 'endsAt', 'courseId', 'note'])) invalid()
    requireId(value.requestId)
    if (!timestamp(value.startsAt) || !timestamp(value.endsAt) || Date.parse(value.endsAt) <= Date.parse(value.startsAt) || Date.parse(value.endsAt) - Date.parse(value.startsAt) > 24 * 3600000 || getFamilyDate(new Date(value.startsAt)) !== getFamilyDate(new Date(value.endsAt))) invalid()
    const courseId = value.courseId ?? null
    if (courseId !== null) requireId(courseId)
    if (k === 'FITNESS' && courseId !== null) invalid()
    const input: ActivityPlanInput = { requestId: value.requestId, title: text(value.title, 120), startsAt: value.startsAt, endsAt: value.endsAt, courseId, note: note(value.note) }
    return this.run(() => this.repository.save(actor.id, k, id as string | null, input))
  }
  async complete(actor: SafeFamilyProfile, id: unknown, value: unknown, correct: boolean) {
    allowed(actor); requireId(id)
    if (!object(value) || !only(value, ['durationMinutes', 'note']) || !Number.isInteger(value.durationMinutes) || (value.durationMinutes as number) < 1 || (value.durationMinutes as number) > 1440) invalid()
    const input = { durationMinutes: value.durationMinutes as number, note: note(value.note) }
    return this.run(() => this.repository.complete(actor.id, id, input, correct))
  }
  async cancel(actor: SafeFamilyProfile, id: unknown) { allowed(actor); requireId(id); return this.run(() => this.repository.cancel(actor.id, id)) }
  private async run<T>(operation: () => Promise<T>) { try { return await operation() } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(503, 'ACTIVITY_UNAVAILABLE', 'Activity plans are temporarily unavailable') } }
}
function allowed(actor: SafeFamilyProfile) { if (!['ADMIN','MEMBER'].includes(actor.role)) throw new ApiError(403, 'ACTIVITY_FORBIDDEN', 'This workspace is private') }
function kindValue(value: unknown): ActivityKind { if (value !== 'STUDY' && value !== 'FITNESS') invalid(); return value }
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function only(value: Record<string, unknown>, keys: string[]) { return Object.keys(value).every(k => keys.includes(k)) }
function text(value: unknown, max: number) { if (typeof value !== 'string' || !value.trim() || Array.from(value.trim()).length > max) invalid(); return value.trim() }
function note(value: unknown) { return value === undefined || value === null || value === '' ? null : text(value, 1000) }
function invalid(): never { throw new ApiError(400, 'ACTIVITY_INVALID', 'Invalid activity input') }
