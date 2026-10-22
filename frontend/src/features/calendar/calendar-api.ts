export const CATEGORIES = [
  'SCHOOL',
  'WORK',
  'FITNESS',
  'FAMILY',
  'APPOINTMENT',
  'PERSONAL',
  'OTHER',
] as const
export interface CalendarMember {
  id: string
  displayName: string
  avatarType: string | null
  avatarValue: string | null
}
export interface CalendarInput {
  calendarType?: 'FAMILY' | 'PERSONAL'
  title: string
  category: (typeof CATEGORIES)[number]
  startsAt: string
  endsAt: string
  note: string | null
  weekdays: number[] | null
  recurrenceUntil: string | null
}
export interface CalendarEvent extends CalendarInput {
  activity?: { id: string; kind: 'STUDY' | 'FITNESS'; completedAt: string | null } | null
  id: string
  ownerMemberId: string
  createdAt: string
  updatedAt: string
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
export interface CalendarView {
  from: string
  to: string
  timeZone: string
  members: CalendarMember[]
  occurrences: CalendarOccurrence[]
}
export class CalendarApiError extends Error {
  readonly code: string
  constructor(code: string) {
    super('Calendar request failed')
    this.code = code
  }
}
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`/api/calendar${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (!response.ok) {
    let code = 'CALENDAR_UNAVAILABLE'
    try {
      const error: unknown = await response.json()
      if (
        object(error) &&
        object(error.error) &&
        typeof error.error.code === 'string'
      )
        code = error.error.code
    } catch {
      /* Non-JSON responses use the same safe fallback. */
    }
    throw new CalendarApiError(code)
  }
  return response.status === 204 ? null : ((await response.json()) as unknown)
}
export async function fetchCalendar(
  from: string,
  to: string,
  memberId: string | null,
  signal: AbortSignal,
  calendarType: 'FAMILY' | 'PERSONAL' = 'FAMILY',
): Promise<CalendarView> {
  const query = new URLSearchParams({ from, to })
  query.set('calendarType', calendarType)
  if (memberId) query.set('memberId', memberId)
  const body = await request(`?${query}`, { signal })
  if (!object(body) || !object(body.calendar)) invalid()
  const view = body.calendar
  if (
    !day(view.from) ||
    !day(view.to) ||
    typeof view.timeZone !== 'string' ||
    !Array.isArray(view.members) ||
    !Array.isArray(view.occurrences)
  )
    invalid()
  return {
    from: view.from,
    to: view.to,
    timeZone: view.timeZone,
    members: view.members.map(readMember),
    occurrences: view.occurrences.map(readOccurrence),
  }
}
export async function duplicateCalendarWeek(
  sourceWeek: string,
): Promise<number> {
  const data = await request('/duplicate-week', {
    method: 'POST',
    body: JSON.stringify({ sourceWeek }),
  })
  if (
    !object(data) ||
    typeof data.copied !== 'number' ||
    !Number.isInteger(data.copied) ||
    data.copied < 0
  )
    invalid()
  return data.copied
}
export async function saveCalendarEvent(
  input: CalendarInput,
  eventId: string | null,
) {
  await request(
    eventId ? `/events/${encodeURIComponent(eventId)}` : '/events',
    { method: eventId ? 'PUT' : 'POST', body: JSON.stringify(input) },
  )
}
export async function deleteCalendarEvent(eventId: string) {
  await request(`/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' })
}
export async function saveCalendarException(
  eventId: string,
  date: string,
  input:
    | { cancelled: true }
    | {
        cancelled: false
        title: string
        startsAt: string
        endsAt: string
        note: string | null
      },
) {
  await request(
    `/events/${encodeURIComponent(eventId)}/occurrences/${encodeURIComponent(date)}`,
    { method: 'PUT', body: JSON.stringify(input) },
  )
}
function readMember(value: unknown): CalendarMember {
  if (
    !object(value) ||
    typeof value.id !== 'string' ||
    typeof value.displayName !== 'string' ||
    !nullable(value.avatarType) ||
    !nullable(value.avatarValue)
  )
    invalid()
  return {
    id: value.id,
    displayName: value.displayName,
    avatarType: value.avatarType as string | null,
    avatarValue: value.avatarValue as string | null,
  }
}
function readOccurrence(value: unknown): CalendarOccurrence {
  if (
    !object(value) ||
    !object(value.event) ||
    !day(value.date) ||
    typeof value.title !== 'string' ||
    !stamp(value.startsAt) ||
    !stamp(value.endsAt) ||
    !nullable(value.note) ||
    typeof value.cancelled !== 'boolean' ||
    typeof value.isException !== 'boolean'
  )
    invalid()
  const e = value.event
  if (
    typeof e.id !== 'string' ||
    typeof e.ownerMemberId !== 'string' ||
    typeof e.title !== 'string' ||
    !CATEGORIES.includes(e.category as never) ||
    (e.calendarType !== undefined &&
      e.calendarType !== 'FAMILY' &&
      e.calendarType !== 'PERSONAL') ||
    !stamp(e.startsAt) ||
    !stamp(e.endsAt) ||
    !nullable(e.note) ||
    !stamp(e.createdAt) ||
    !stamp(e.updatedAt) ||
    (e.weekdays !== null &&
      (!Array.isArray(e.weekdays) ||
        !e.weekdays.every((n) => Number.isInteger(n) && n >= 1 && n <= 7))) ||
    (e.recurrenceUntil !== null && !day(e.recurrenceUntil))
  )
    invalid()
  return {
    event: {
      ...(e.activity === undefined ? {} : { activity: readActivity(e.activity) }),
      ...(e.calendarType === undefined
        ? {}
        : { calendarType: e.calendarType as 'FAMILY' | 'PERSONAL' }),
      id: e.id,
      ownerMemberId: e.ownerMemberId,
      title: e.title,
      category: e.category as CalendarInput['category'],
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      note: e.note as string | null,
      weekdays: e.weekdays as number[] | null,
      recurrenceUntil: e.recurrenceUntil as string | null,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    },
    owner: readMember(value.owner),
    date: value.date,
    title: value.title,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    note: value.note as string | null,
    cancelled: value.cancelled,
    isException: value.isException,
  }
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function readActivity(value: unknown): CalendarEvent['activity'] {
  if (value === null) return null
  if (!object(value) || typeof value.id !== 'string' || (value.kind !== 'STUDY' && value.kind !== 'FITNESS') || !(value.completedAt === null || stamp(value.completedAt))) invalid()
  return { id: value.id, kind: value.kind, completedAt: value.completedAt as string | null }
}
function nullable(value: unknown) {
  return value === null || typeof value === 'string'
}
function day(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value))
  )
}
function stamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}
function invalid(): never {
  throw new CalendarApiError('CALENDAR_UNAVAILABLE')
}
export function calendarError(error: unknown) {
  if (error instanceof CalendarApiError) {
    if (error.code === 'CALENDAR_FORBIDDEN')
      return 'Bạn chỉ có thể thay đổi lịch của mình.'
    if (error.code === 'CALENDAR_EXCEPTIONS_EXIST')
      return 'Lịch này đã có thay đổi riêng. Hãy chỉnh từng lần để giữ nguyên các buổi đã đổi nhé.'
    if (error.code === 'CALENDAR_NOT_FOUND')
      return 'Lịch này không còn nữa. Bạn tải lại lịch nhé.'
    if (error.code === 'CALENDAR_INVALID')
      return 'Bạn kiểm tra lại tiêu đề, ngày và giờ kết thúc nhé.'
    if (error.code === 'UNAUTHENTICATED')
      return 'Phiên đăng nhập đã hết. Bạn tải lại trang để vào nhà nhé.'
  }
  return 'Chưa thể cập nhật lịch. Bạn thử lại nhé.'
}
