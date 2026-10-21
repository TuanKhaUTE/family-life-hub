import { ApiError } from '../errors/api-error.js'
import {
  FAMILY_TIME_ZONE,
  getFamilyDate,
  isFamilyDate,
} from '../time/family-calendar.js'
import type { SafeFamilyProfile } from './family-auth.service.js'

export const CALENDAR_CATEGORIES = [
  'SCHOOL',
  'WORK',
  'FITNESS',
  'FAMILY',
  'APPOINTMENT',
  'PERSONAL',
  'OTHER',
] as const
export interface CalendarInput {
  title: string
  category: (typeof CALENDAR_CATEGORIES)[number]
  startsAt: string
  endsAt: string
  note: string | null
  weekdays: number[] | null
  recurrenceUntil: string | null
}
export interface CalendarEvent extends CalendarInput {
  id: string
  ownerMemberId: string
  createdAt: string
  updatedAt: string
}
export interface CalendarMember {
  id: string
  displayName: string
  avatarType: string | null
  avatarValue: string | null
}
export interface CalendarOccurrence {
  event: CalendarEvent
  owner: CalendarMember
  date: string
  title: string
  startsAt: string
  endsAt: string
  note: string | null
  cancelled: boolean
  isException: boolean
}
export interface CalendarException {
  cancelled: boolean
  title: string | null
  startsAt: string | null
  endsAt: string | null
  note: string | null
}
export interface CalendarRepository {
  list(
    actorId: string,
    from: string,
    to: string,
    memberId: string | null,
  ): Promise<{ members: CalendarMember[]; occurrences: CalendarOccurrence[] }>
  save(
    actorId: string,
    eventId: string | null,
    input: CalendarInput,
  ): Promise<string>
  remove(actorId: string, eventId: string): Promise<void>
  exception(
    actorId: string,
    eventId: string,
    date: string,
    input: CalendarException,
  ): Promise<void>
}
export class CalendarService {
  constructor(
    private readonly repository: CalendarRepository,
    private readonly clock = () => new Date(),
  ) {}
  async list(
    actor: SafeFamilyProfile,
    from: unknown = undefined,
    to: unknown = undefined,
    memberId: unknown = undefined,
  ) {
    const first = from ?? getFamilyDate(this.clock())
    const last = to ?? first
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
  async save(actor: SafeFamilyProfile, eventId: unknown, value: unknown) {
    if (eventId !== null) requireId(eventId)
    const input = normalizeCalendarInput(value)
    return this.run(() =>
      this.repository.save(actor.id, eventId as string | null, input),
    )
  }
  async remove(actor: SafeFamilyProfile, eventId: unknown) {
    requireId(eventId)
    return this.run(() => this.repository.remove(actor.id, eventId))
  }
  async exception(
    actor: SafeFamilyProfile,
    eventId: unknown,
    date: unknown,
    value: unknown,
  ) {
    requireId(eventId)
    if (
      !validDate(date) ||
      !object(value) ||
      typeof value.cancelled !== 'boolean'
    )
      invalid()
    let input: CalendarException
    if (value.cancelled) {
      if (!keys(value, ['cancelled'])) invalid()
      input = {
        cancelled: true,
        title: null,
        startsAt: null,
        endsAt: null,
        note: null,
      }
    } else {
      if (!keys(value, ['cancelled', 'title', 'startsAt', 'endsAt', 'note']))
        invalid()
      const times = normalizeTimes(value.startsAt, value.endsAt)
      input = {
        cancelled: false,
        title: normalizeText(value.title, 120),
        ...times,
        note: normalizeNote(value.note),
      }
    }
    return this.run(() =>
      this.repository.exception(actor.id, eventId, date, input),
    )
  }
  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        503,
        'CALENDAR_UNAVAILABLE',
        'Calendar is temporarily unavailable',
      )
    }
  }
}
export function normalizeCalendarInput(value: unknown): CalendarInput {
  if (
    !object(value) ||
    !keys(value, [
      'title',
      'category',
      'startsAt',
      'endsAt',
      'note',
      'weekdays',
      'recurrenceUntil',
    ]) ||
    !CALENDAR_CATEGORIES.includes(value.category as never)
  )
    invalid()
  const times = normalizeTimes(value.startsAt, value.endsAt)
  const weekdays = value.weekdays ?? null
  const until = value.recurrenceUntil ?? null
  if (
    weekdays !== null &&
    (!Array.isArray(weekdays) ||
      weekdays.length < 1 ||
      weekdays.length > 7 ||
      new Set(weekdays).size !== weekdays.length ||
      !weekdays.every((n) => Number.isInteger(n) && n >= 1 && n <= 7))
  )
    invalid()
  if (
    weekdays !== null &&
    getFamilyDate(new Date(times.startsAt)) !==
      getFamilyDate(new Date(times.endsAt))
  )
    invalid()
  if (
    until !== null &&
    (!validDate(until) ||
      weekdays === null ||
      until < getFamilyDate(new Date(times.startsAt)))
  )
    invalid()
  return {
    title: normalizeText(value.title, 120),
    category: value.category as CalendarInput['category'],
    ...times,
    note: normalizeNote(value.note),
    weekdays: weekdays as number[] | null,
    recurrenceUntil: until as string | null,
  }
}
function normalizeTimes(start: unknown, end: unknown) {
  if (
    !timestamp(start) ||
    !timestamp(end) ||
    Date.parse(start) >= Date.parse(end) ||
    Date.parse(end) - Date.parse(start) > 31 * 86400000
  )
    invalid()
  return { startsAt: start, endsAt: end }
}
export function timestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) &&
    validDate(value.slice(0, 10)) &&
    Number.isFinite(Date.parse(value))
  )
}
export function validDate(value: unknown): value is string {
  return isFamilyDate(value) && value >= '2000-01-01' && value <= '2199-12-31'
}
function normalizeText(value: unknown, max: number): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    Array.from(value.trim()).length > max
  )
    invalid()
  return value.trim()
}
function normalizeNote(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') invalid()
  return value.trim() ? normalizeText(value, 1000) : null
}
export function requireId(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    invalid()
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).every((key) => allowed.includes(key))
}
function invalid(): never {
  throw new ApiError(400, 'CALENDAR_INVALID', 'Invalid calendar input')
}
