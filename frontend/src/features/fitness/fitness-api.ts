export type FitnessKind = 'plans' | 'days' | 'goals' | 'sessions'
export interface FitnessPlan {
  id: string
  name: string
  note: string | null
  isActive: boolean
}
export interface FitnessDay {
  id: string
  planId: string
  weekday: number
  title: string
  note: string | null
}
export interface FitnessGoal {
  id: string
  weeklySessionTarget: number
  isActive: boolean
}
export interface FitnessSession {
  id: string
  planDayId: string | null
  performedAt: string
  durationMinutes: number | null
  title: string
  note: string | null
}
export type FitnessRecord =
  | FitnessPlan
  | FitnessDay
  | FitnessGoal
  | FitnessSession
export interface FitnessSummary {
  weekStart: string
  weekEnd: string
  sessionsThisWeek: number
  weeklyTarget: number | null
  completionPercent: number | null
  totalMinutes: number
  unrecordedDurationCount: number
  nextWorkout: {
    planDayId: string
    title: string
    date: string
    weekday: number
  } | null
}
export type FitnessHomeSummary = Omit<FitnessSummary, 'nextWorkout'>
export interface FitnessWorkspace {
  plans: FitnessPlan[]
  days: FitnessDay[]
  goals: FitnessGoal[]
  sessions: FitnessSession[]
  summary: FitnessSummary
}
export class FitnessApiError extends Error {
  readonly code: string
  constructor(code: string) {
    super('Fitness unavailable')
    this.code = code
  }
}
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`/api/fitness${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (!response.ok) {
    let code = 'FITNESS_UNAVAILABLE'
    try {
      const body: unknown = await response.json()
      if (
        object(body) &&
        object(body.error) &&
        typeof body.error.code === 'string'
      )
        code = body.error.code
    } catch {}
    throw new FitnessApiError(code)
  }
  return response.status === 204 ? null : ((await response.json()) as unknown)
}
export async function fetchFitness(
  signal: AbortSignal,
): Promise<FitnessWorkspace> {
  const body = await request('', { signal })
  if (!object(body) || !object(body.fitness)) invalid()
  const v = body.fitness
  if (
    !Array.isArray(v.plans) ||
    !Array.isArray(v.days) ||
    !Array.isArray(v.goals) ||
    !Array.isArray(v.sessions) ||
    !validFitnessSummary(v.summary)
  )
    invalid()
  const s = v.summary
  let next: FitnessSummary['nextWorkout'] = null
  if (s.nextWorkout !== null) {
    const n = s.nextWorkout
    if (
      !object(n) ||
      !text(n.planDayId) ||
      !text(n.title) ||
      !day(n.date) ||
      !integer(n.weekday, 1, 7)
    )
      invalid()
    next = {
      planDayId: n.planDayId,
      title: n.title,
      date: n.date,
      weekday: n.weekday as number,
    }
  }
  return {
    plans: v.plans.map((p) => {
      if (
        !record(p) ||
        !text(p.name) ||
        !nullableText(p.note) ||
        typeof p.isActive !== 'boolean'
      )
        invalid()
      return {
        id: p.id,
        name: p.name,
        note: p.note as string | null,
        isActive: p.isActive,
      }
    }),
    days: v.days.map((d) => {
      if (
        !record(d) ||
        !text(d.planId) ||
        !integer(d.weekday, 1, 7) ||
        !text(d.title) ||
        !nullableText(d.note)
      )
        invalid()
      return {
        id: d.id,
        planId: d.planId,
        weekday: d.weekday as number,
        title: d.title,
        note: d.note as string | null,
      }
    }),
    goals: v.goals.map((g) => {
      if (
        !record(g) ||
        !integer(g.weeklySessionTarget, 1, 21) ||
        typeof g.isActive !== 'boolean'
      )
        invalid()
      return {
        id: g.id,
        weeklySessionTarget: g.weeklySessionTarget as number,
        isActive: g.isActive,
      }
    }),
    sessions: v.sessions.map((s) => {
      if (
        !record(s) ||
        !nullableText(s.planDayId) ||
        !day(s.performedAt) ||
        !(s.durationMinutes === null || integer(s.durationMinutes, 1, 1440)) ||
        !text(s.title) ||
        !nullableText(s.note)
      )
        invalid()
      return {
        id: s.id,
        planDayId: s.planDayId as string | null,
        performedAt: s.performedAt,
        durationMinutes: s.durationMinutes as number | null,
        title: s.title,
        note: s.note as string | null,
      }
    }),
    summary: {
      weekStart: s.weekStart,
      weekEnd: s.weekEnd,
      sessionsThisWeek: s.sessionsThisWeek,
      weeklyTarget: s.weeklyTarget,
      completionPercent: s.completionPercent,
      totalMinutes: s.totalMinutes,
      unrecordedDurationCount: s.unrecordedDurationCount,
      nextWorkout: next,
    },
  }
}
export async function saveFitness(
  kind: FitnessKind,
  id: string | null,
  input: unknown,
) {
  await request(`/${kind}${id ? `/${encodeURIComponent(id)}` : ''}`, {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(input),
  })
}
export async function deleteFitness(kind: FitnessKind, id: string) {
  await request(`/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
export function fitnessError(error: unknown) {
  if (error instanceof FitnessApiError) {
    if (error.code === 'FITNESS_FORBIDDEN')
      return 'Đây là góc rèn luyện riêng của mỗi bạn.'
    if (error.code === 'FITNESS_NOT_FOUND')
      return 'Mục này không còn trong góc rèn luyện của bạn. Bạn tải lại nhé.'
    if (error.code === 'FITNESS_DAY_EXISTS')
      return 'Kế hoạch này đã có buổi tập vào ngày bạn chọn. Bạn chỉnh sửa buổi đang có hoặc chọn ngày khác nhé.'
    if (error.code === 'FITNESS_IN_USE')
      return 'Mục này đang gắn với lịch hoặc buổi tập đã ghi. Bạn chuyển liên kết hay xóa các mục liên quan trước nhé.'
    if (error.code === 'FITNESS_INVALID')
      return 'Bạn kiểm tra tên, ngày đã tập, mục tiêu từ 1 đến 21 buổi và thời lượng từ 1 đến 1.440 phút nhé.'
    if (error.code === 'UNAUTHENTICATED')
      return 'Phiên đăng nhập đã hết. Bạn tải lại trang để vào nhà nhé.'
  }
  return 'Chưa thể cập nhật rèn luyện. Bạn thử lại nhé.'
}
export function validFitnessSummary(
  v: unknown,
): v is FitnessHomeSummary & Record<string, unknown> {
  return (
    object(v) &&
    day(v.weekStart) &&
    day(v.weekEnd) &&
    integer(v.sessionsThisWeek, 0, Number.MAX_SAFE_INTEGER) &&
    integer(v.totalMinutes, 0, Number.MAX_SAFE_INTEGER) &&
    integer(v.unrecordedDurationCount, 0, v.sessionsThisWeek as number) &&
    (v.weeklyTarget === null || integer(v.weeklyTarget, 1, 21)) &&
    (v.completionPercent === null || integer(v.completionPercent, 0, 100))
  )
}
function object(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
function record(v: unknown): v is Record<string, unknown> & { id: string } {
  return object(v) && text(v.id)
}
function text(v: unknown): v is string {
  return typeof v === 'string'
}
function nullableText(v: unknown) {
  return v === null || text(v)
}
function day(v: unknown): v is string {
  return (
    text(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v))
  )
}
function integer(v: unknown, min: number, max: number): v is number {
  return Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max
}
function invalid(): never {
  throw new FitnessApiError('FITNESS_UNAVAILABLE')
}
