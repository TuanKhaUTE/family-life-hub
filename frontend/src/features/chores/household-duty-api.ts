import type { CalendarMember } from '../calendar/calendar-api'
export interface HouseholdDuty {
  id: string
  date: string
  assignee: CalendarMember
  cancelled: boolean
  completedAt: string | null
  completedByMemberId: string | null
}
export interface HouseholdView {
  members: CalendarMember[]
  duties: HouseholdDuty[]
}
class DutyApiError extends Error {
  readonly code: string
  constructor(code: string) {
    super('Duty request failed')
    this.code = code
  }
}
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`/api/chores/duties${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (!response.ok) {
    let code = ''
    try {
      const value: unknown = await response.json()
      if (
        record(value) &&
        record(value.error) &&
        typeof value.error.code === 'string'
      )
        code = value.error.code
    } catch {
      /* Safe fallback for proxy/network errors. */
    }
    throw new DutyApiError(code)
  }
  return response.status === 204 ? null : ((await response.json()) as unknown)
}
export async function fetchHouseholdDuties(
  from: string,
  to: string,
  signal: AbortSignal,
): Promise<HouseholdView> {
  const data = await request(`?${new URLSearchParams({ from, to })}`, {
    signal,
  })
  if (
    !record(data) ||
    !record(data.household) ||
    !Array.isArray(data.household.members) ||
    !data.household.members.every(validMember) ||
    !Array.isArray(data.household.duties) ||
    !data.household.duties.every(validHouseholdDuty)
  )
    throw new Error('Invalid duty response')
  return { members: data.household.members, duties: data.household.duties }
}
export async function saveDutyWeek(
  assignments: { date: string; memberId: string }[],
) {
  await request('/week', {
    method: 'PUT',
    body: JSON.stringify({ assignments }),
  })
}
export async function duplicateDutyWeek(sourceWeek: string): Promise<number> {
  const data = await request('/duplicate-week', {
    method: 'POST',
    body: JSON.stringify({ sourceWeek }),
  })
  if (
    !record(data) ||
    typeof data.copied !== 'number' ||
    !Number.isInteger(data.copied) ||
    data.copied < 0
  )
    throw new Error('Invalid copy result')
  return data.copied
}
export async function completeDuty(date: string) {
  await request(`/${encodeURIComponent(date)}/complete`, { method: 'POST' })
  window.dispatchEvent(new Event('family-notifications-changed'))
}
export async function cancelDuty(date: string) {
  await request(`/${encodeURIComponent(date)}`, { method: 'DELETE' })
}
export function dutyError(error: unknown) {
  if (error instanceof DutyApiError) {
    if (error.code === 'DUTY_CONFLICT')
      return 'Ngày này đã có lịch khác hoặc đã hoàn thành. Bạn tải lại để xem phân công mới nhé.'
    if (error.code === 'DUTY_TODAY_ONLY')
      return 'Chỉ có thể xác nhận việc được giao trong hôm nay.'
    if (error.code === 'DUTY_FORBIDDEN')
      return 'Chỉ Mẹ quản lý lịch; người được giao mới xác nhận hoàn thành nhé.'
    if (error.code === 'UNAUTHENTICATED')
      return 'Phiên đăng nhập đã hết. Bạn tải lại trang để vào nhà nhé.'
  }
  return 'Chưa cập nhật được việc nhà. Bạn tải lại rồi thử nhé.'
}
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}
function validMember(v: unknown): v is CalendarMember {
  return (
    record(v) &&
    typeof v.id === 'string' &&
    typeof v.displayName === 'string' &&
    (v.avatarType === null || typeof v.avatarType === 'string') &&
    (v.avatarValue === null || typeof v.avatarValue === 'string')
  )
}
export function validHouseholdDuty(v: unknown): v is HouseholdDuty {
  return (
    record(v) &&
    typeof v.id === 'string' &&
    typeof v.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
    validMember(v.assignee) &&
    typeof v.cancelled === 'boolean' &&
    (v.completedAt === null ||
      (typeof v.completedAt === 'string' &&
        Number.isFinite(Date.parse(v.completedAt)))) &&
    (v.completedByMemberId === null ||
      typeof v.completedByMemberId === 'string')
  )
}
