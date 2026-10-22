import { ApiError } from '../errors/api-error.js'
import { getFamilyDate } from '../time/family-calendar.js'
import {
  requireId,
  requireMonday,
  validDate,
  type CalendarMember,
} from './calendar.service.js'
import type { SafeFamilyProfile } from './family-auth.service.js'

export interface DutyAssignment {
  date: string
  memberId: string
}
export interface HouseholdDuty {
  id: string
  date: string
  assignee: CalendarMember
  cancelled: boolean
  completedAt: string | null
  completedByMemberId: string | null
}
export interface DutyView {
  members: CalendarMember[]
  duties: HouseholdDuty[]
}
export interface HouseholdDutyRepository {
  list(actorId: string, from: string, to: string): Promise<DutyView>
  saveWeek(actorId: string, assignments: DutyAssignment[]): Promise<void>
  duplicateWeek(actorId: string, sourceWeek: string): Promise<number>
  complete(actorId: string, date: string): Promise<void>
  cancel(actorId: string, date: string): Promise<void>
}
export class HouseholdDutyService {
  constructor(
    private readonly repository: HouseholdDutyRepository,
    private readonly clock = () => new Date(),
  ) {}
  async list(
    actor: SafeFamilyProfile,
    from: unknown = getFamilyDate(this.clock()),
    to: unknown = from,
  ) {
    if (
      !validDate(from) ||
      !validDate(to) ||
      to < from ||
      Date.parse(to) - Date.parse(from) > 30 * 86400000
    )
      invalid()
    return this.run(() => this.repository.list(actor.id, from, to))
  }
  async recentCompletions(
    actor: SafeFamilyProfile,
    throughDate: string,
    limit = 30,
  ) {
    if (!validDate(throughDate) || !Number.isInteger(limit) || limit < 1 || limit > 30)
      invalid()
    return this.list(actor, shiftDate(throughDate, -(limit - 1)), throughDate)
  }
  async saveWeek(actor: SafeFamilyProfile, value: unknown) {
    parentOnly(actor)
    if (
      !record(value) ||
      !only(value, ['assignments']) ||
      !Array.isArray(value.assignments) ||
      value.assignments.length < 1 ||
      value.assignments.length > 7
    )
      invalid()
    const assignments = value.assignments
      .map((item): DutyAssignment => {
        if (
          !record(item) ||
          !only(item, ['date', 'memberId']) ||
          !validDate(item.date)
        )
          invalid()
        requireId(item.memberId)
        return { date: item.date, memberId: item.memberId }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
    if (
      new Set(assignments.map((a) => a.date)).size !== assignments.length ||
      Date.parse(assignments.at(-1)!.date) - Date.parse(assignments[0]!.date) >
        6 * 86400000
    )
      invalid()
    return this.run(() => this.repository.saveWeek(actor.id, assignments))
  }
  async duplicateWeek(actor: SafeFamilyProfile, value: unknown) {
    parentOnly(actor)
    if (!record(value) || !only(value, ['sourceWeek'])) invalid()
    const source = requireMonday(value.sourceWeek)
    if (source > '2199-12-17') invalid()
    return this.run(() => this.repository.duplicateWeek(actor.id, source))
  }
  async complete(actor: SafeFamilyProfile, date: unknown) {
    if (!validDate(date)) invalid()
    if (date !== getFamilyDate(this.clock()))
      throw new ApiError(409, 'DUTY_TODAY_ONLY', 'Only today can be completed')
    return this.run(() => this.repository.complete(actor.id, date))
  }
  async cancel(actor: SafeFamilyProfile, date: unknown) {
    parentOnly(actor)
    if (!validDate(date)) invalid()
    return this.run(() => this.repository.cancel(actor.id, date))
  }
  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        503,
        'DUTY_UNAVAILABLE',
        'Household duties are temporarily unavailable',
      )
    }
  }
}
function parentOnly(actor: SafeFamilyProfile) {
  if (actor.role !== 'PARENT')
    throw new ApiError(403, 'DUTY_FORBIDDEN', 'Parent required')
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function only(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).every((k) => keys.includes(k))
}
function invalid(): never {
  throw new ApiError(400, 'DUTY_INVALID', 'Invalid household duty input')
}
function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
