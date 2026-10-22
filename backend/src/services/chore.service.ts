import { ApiError } from '../errors/api-error.js'
import { getFamilyDate, FAMILY_TIME_ZONE } from '../time/family-calendar.js'
import {
  requireId,
  validDate,
  type CalendarMember,
} from './calendar.service.js'
import type { SafeFamilyProfile } from './family-auth.service.js'
export const CHORE_CATEGORIES = [
  'DISHES',
  'TRASH',
  'CLEANING',
  'SHOPPING',
  'LAUNDRY',
  'OTHER',
] as const
export interface ChoreInput {
  requestId: string
  title: string
  category: (typeof CHORE_CATEGORIES)[number]
  scheduledDate: string
  scheduledTime: string | null
  assignedMemberId: string | null
  weeklyAssignments: { weekday: number; memberId: string }[]
  recurrenceUntil: string | null
  note: string | null
}
export interface ChoreSchedule extends ChoreInput {
  id: string
  createdByMemberId: string
  cancelled: boolean
  createdAt: string
  updatedAt: string
}
export interface ChoreOccurrence {
  schedule: ChoreSchedule
  date: string
  assignee: CalendarMember
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED'
  completedAt: string | null
  completedByMemberId: string | null
}
export interface ChoreRepository {
  list(
    actorId: string,
    from: string,
    to: string,
    memberId: string | null,
  ): Promise<{ members: CalendarMember[]; chores: ChoreOccurrence[] }>
  save(
    actorId: string,
    scheduleId: string | null,
    input: ChoreInput,
  ): Promise<string>
  cancelSchedule(actorId: string, scheduleId: string): Promise<void>
  cancelOccurrence(
    actorId: string,
    scheduleId: string,
    date: string,
  ): Promise<void>
  complete(actorId: string, scheduleId: string, date: string): Promise<void>
}
export class ChoreService {
  constructor(
    private readonly repository: ChoreRepository,
    private readonly clock = () => new Date(),
  ) {}
  async list(
    actor: SafeFamilyProfile,
    from: unknown = undefined,
    to: unknown = undefined,
    memberId: unknown = undefined,
  ) {
    const first = from ?? getFamilyDate(this.clock()),
      last = to ?? first
    if (
      !validDate(first) ||
      !validDate(last) ||
      last < first ||
      Date.parse(last) - Date.parse(first) > 30 * 86400000
    )
      invalid()
    if (memberId !== undefined && memberId !== null) requireId(memberId)
    const result = await this.run(() =>
      this.repository.list(
        actor.id,
        first,
        last,
        (memberId as string | undefined) ?? null,
      ),
    )
    return { from: first, to: last, timeZone: FAMILY_TIME_ZONE, ...result }
  }
  async save(actor: SafeFamilyProfile, scheduleId: unknown, input: unknown) {
    parent(actor)
    if (scheduleId !== null) requireId(scheduleId)
    const normalized = normalizeChore(input)
    return this.run(() =>
      this.repository.save(actor.id, scheduleId as string | null, normalized),
    )
  }
  async cancelSchedule(actor: SafeFamilyProfile, id: unknown) {
    parent(actor)
    requireId(id)
    return this.run(() => this.repository.cancelSchedule(actor.id, id))
  }
  async occurrence(
    actor: SafeFamilyProfile,
    id: unknown,
    date: unknown,
    action: 'complete' | 'cancel',
    input: unknown,
  ) {
    if (action === 'cancel') parent(actor)
    requireId(id)
    if (
      !validDate(date) ||
      !object(input) ||
      Object.keys(input).length ||
      (action === 'complete' && date > getFamilyDate(this.clock()))
    )
      invalid()
    return this.run(() =>
      action === 'complete'
        ? this.repository.complete(actor.id, id, date)
        : this.repository.cancelOccurrence(actor.id, id, date),
    )
  }
  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        503,
        'CHORE_UNAVAILABLE',
        'Chores are temporarily unavailable',
      )
    }
  }
}
export function normalizeChore(value: unknown): ChoreInput {
  if (
    !object(value) ||
    Object.keys(value).some(
      (k) =>
        ![
          'requestId',
          'title',
          'category',
          'scheduledDate',
          'scheduledTime',
          'assignedMemberId',
          'weeklyAssignments',
          'recurrenceUntil',
          'note',
        ].includes(k),
    )
  )
    invalid()
  requireId(value.requestId)
  if (
    !validDate(value.scheduledDate) ||
    !CHORE_CATEGORIES.includes(value.category as never)
  )
    invalid()
  const time = value.scheduledTime ?? null,
    until = value.recurrenceUntil ?? null,
    assignee = value.assignedMemberId ?? null
  if (
    time !== null &&
    (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
  )
    invalid()
  if (
    !Array.isArray(value.weeklyAssignments) ||
    value.weeklyAssignments.length > 7
  )
    invalid()
  const weekly = value.weeklyAssignments
    .map((entry): { weekday: number; memberId: string } => {
      if (
        !object(entry) ||
        Object.keys(entry).some((k) => !['weekday', 'memberId'].includes(k)) ||
        !Number.isInteger(entry.weekday) ||
        (entry.weekday as number) < 1 ||
        (entry.weekday as number) > 7
      )
        invalid()
      requireId(entry.memberId)
      return { weekday: entry.weekday as number, memberId: entry.memberId }
    })
    .sort((a, b) => a.weekday - b.weekday)
  if (new Set(weekly.map((e) => e.weekday)).size !== weekly.length) invalid()
  if (weekly.length) {
    if (assignee !== null) invalid()
  } else {
    requireId(assignee)
    if (until !== null) invalid()
  }
  if (until !== null && (!validDate(until) || until < value.scheduledDate))
    invalid()
  return {
    requestId: value.requestId,
    title: text(value.title, 120),
    category: value.category as ChoreInput['category'],
    scheduledDate: value.scheduledDate,
    scheduledTime: time as string | null,
    assignedMemberId: assignee as string | null,
    weeklyAssignments: weekly,
    recurrenceUntil: until as string | null,
    note:
      value.note === null || value.note === undefined
        ? null
        : typeof value.note === 'string'
          ? value.note.trim()
            ? text(value.note, 1000)
            : null
          : invalid(),
  }
}
function text(value: unknown, max: number) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    Array.from(value.trim()).length > max
  )
    invalid()
  return value.trim()
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function parent(actor: SafeFamilyProfile) {
  if (actor.role !== 'PARENT')
    throw new ApiError(
      403,
      'CHORE_FORBIDDEN',
      'Only a parent can manage family chores',
    )
}
function invalid(): never {
  throw new ApiError(400, 'CHORE_INVALID', 'Invalid chore input')
}
