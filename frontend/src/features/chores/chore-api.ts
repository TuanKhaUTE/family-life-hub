export const CHORE_CATEGORIES = [
  'DISHES',
  'TRASH',
  'CLEANING',
  'SHOPPING',
  'LAUNDRY',
  'OTHER',
] as const
export interface ChoreMember {
  id: string
  displayName: string
  avatarType: string | null
  avatarValue: string | null
}
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
export interface ChoreItem {
  schedule: ChoreSchedule
  date: string
  assignee: ChoreMember
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED'
  completedAt: string | null
  completedByMemberId: string | null
}
export interface ChoreView {
  from: string
  to: string
  timeZone: string
  members: ChoreMember[]
  chores: ChoreItem[]
}
export class ChoreApiError extends Error {
  readonly code: string
  constructor(code: string) {
    super('Chore request failed')
    this.code = code
  }
}
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`/api/chores${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (!response.ok) {
    let code = 'CHORE_UNAVAILABLE'
    try {
      const body: unknown = await response.json()
      if (
        object(body) &&
        object(body.error) &&
        typeof body.error.code === 'string'
      )
        code = body.error.code
    } catch {}
    throw new ChoreApiError(code)
  }
  return response.status === 204 ? null : ((await response.json()) as unknown)
}
export async function fetchChores(
  from: string,
  to: string,
  memberId: string | null,
  signal: AbortSignal,
): Promise<ChoreView> {
  const query = new URLSearchParams({ from, to })
  if (memberId) query.set('memberId', memberId)
  const body = await request(`?${query}`, { signal })
  if (!object(body) || !object(body.chores)) invalid()
  const v = body.chores
  if (
    !day(v.from) ||
    !day(v.to) ||
    typeof v.timeZone !== 'string' ||
    !Array.isArray(v.members) ||
    !Array.isArray(v.chores)
  )
    invalid()
  return {
    from: v.from,
    to: v.to,
    timeZone: v.timeZone,
    members: v.members.map(readMember),
    chores: v.chores.map(readItem),
  }
}
export async function saveChore(input: ChoreInput, id: string | null) {
  await request(id ? `/schedules/${encodeURIComponent(id)}` : '/schedules', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(input),
  })
  notify()
}
export async function completeChore(id: string, date: string) {
  await request(
    `/schedules/${encodeURIComponent(id)}/occurrences/${encodeURIComponent(date)}/complete`,
    { method: 'POST', body: '{}' },
  )
}
export async function cancelChore(id: string, date: string) {
  await request(
    `/schedules/${encodeURIComponent(id)}/occurrences/${encodeURIComponent(date)}/cancel`,
    { method: 'POST', body: '{}' },
  )
}
export async function cancelChoreSchedule(id: string) {
  await request(`/schedules/${encodeURIComponent(id)}`, { method: 'DELETE' })
  notify()
}
function notify() {
  window.dispatchEvent(new Event('family-notifications-changed'))
}
export function readMember(value: unknown): ChoreMember {
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
function readItem(value: unknown): ChoreItem {
  if (
    !object(value) ||
    !object(value.schedule) ||
    !day(value.date) ||
    !['PENDING', 'COMPLETED', 'CANCELLED'].includes(String(value.status)) ||
    !nullable(value.completedAt) ||
    !nullable(value.completedByMemberId)
  )
    invalid()
  const s = value.schedule
  if (
    typeof s.id !== 'string' ||
    typeof s.requestId !== 'string' ||
    typeof s.title !== 'string' ||
    !CHORE_CATEGORIES.includes(s.category as never) ||
    !day(s.scheduledDate) ||
    !nullable(s.scheduledTime) ||
    !nullable(s.assignedMemberId) ||
    !Array.isArray(s.weeklyAssignments) ||
    !s.weeklyAssignments.every(
      (w) =>
        object(w) &&
        Number.isInteger(w.weekday) &&
        (w.weekday as number) >= 1 &&
        (w.weekday as number) <= 7 &&
        typeof w.memberId === 'string',
    ) ||
    !(s.recurrenceUntil === null || day(s.recurrenceUntil)) ||
    !nullable(s.note) ||
    typeof s.createdByMemberId !== 'string' ||
    typeof s.cancelled !== 'boolean' ||
    typeof s.createdAt !== 'string' ||
    typeof s.updatedAt !== 'string'
  )
    invalid()
  const assignee = readMember(value.assignee)
  if (
    value.status === 'COMPLETED'
      ? typeof value.completedAt !== 'string' ||
        !Number.isFinite(Date.parse(value.completedAt)) ||
        value.completedByMemberId !== assignee.id
      : value.completedAt !== null || value.completedByMemberId !== null
  )
    invalid()
  return {
    schedule: {
      id: s.id,
      requestId: s.requestId,
      title: s.title,
      category: s.category as ChoreInput['category'],
      scheduledDate: s.scheduledDate,
      scheduledTime: s.scheduledTime as string | null,
      assignedMemberId: s.assignedMemberId as string | null,
      weeklyAssignments: s.weeklyAssignments.map((w) => ({
        weekday: w.weekday as number,
        memberId: w.memberId as string,
      })),
      recurrenceUntil: s.recurrenceUntil as string | null,
      note: s.note as string | null,
      createdByMemberId: s.createdByMemberId,
      cancelled: s.cancelled,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    },
    date: value.date,
    assignee,
    status: value.status as ChoreItem['status'],
    completedAt: value.completedAt as string | null,
    completedByMemberId: value.completedByMemberId as string | null,
  }
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
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
function invalid(): never {
  throw new ChoreApiError('CHORE_UNAVAILABLE')
}
export function choreError(error: unknown) {
  if (error instanceof ChoreApiError) {
    if (error.code === 'CHORE_FORBIDDEN')
      return 'Bạn chỉ có thể hoàn thành việc được giao cho mình. Chỉ mẹ mới quản lý lịch việc nhà.'
    if (error.code === 'CHORE_CONFLICT')
      return 'Việc này đã thay đổi hoặc đã kết thúc. Bạn tải lại lịch để xem trạng thái mới nhé.'
    if (error.code === 'CHORE_INVALID')
      return 'Bạn kiểm tra tên việc, ngày giờ và chọn thành viên đang hoạt động nhé.'
    if (error.code === 'UNAUTHENTICATED')
      return 'Phiên đăng nhập đã hết. Bạn tải lại trang để vào nhà nhé.'
  }
  return 'Chưa thể cập nhật việc nhà. Bạn thử lại nhé.'
}
