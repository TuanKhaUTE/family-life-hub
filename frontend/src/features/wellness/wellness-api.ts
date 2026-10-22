export const ACTIVITY_LEVELS = [
  'SEDENTARY',
  'LIGHT',
  'MODERATE',
  'ACTIVE',
  'VERY_ACTIVE',
] as const
export interface WellnessProfile {
  heightCm: number | null
  targetWeightKg: number | null
  activityLevel: (typeof ACTIVITY_LEVELS)[number] | null
}
export interface WeightLog {
  id: string
  loggedDate: string
  weightKg: number
  note: string | null
}
export interface WeightTrend {
  fromDate: string
  toDate: string
  changeKg: number
  pointCount: number
}
export interface WellnessSummary {
  currentWeightKg: number | null
  currentLoggedDate: string | null
  previousWeightKg: number | null
  previousLoggedDate: string | null
  changeKg: number | null
  bmi: number | null
  trend7: WeightTrend | null
  trend30: WeightTrend | null
}
export interface WellnessWorkspace {
  profile: WellnessProfile | null
  logs: WeightLog[]
  summary: WellnessSummary
}
export class WellnessApiError extends Error {
  readonly code: string
  constructor(code: string) {
    super('Wellness unavailable')
    this.code = code
  }
}
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`/api/wellness${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (!response.ok) {
    let code = 'WELLNESS_UNAVAILABLE'
    try {
      const body: unknown = await response.json()
      if (
        object(body) &&
        object(body.error) &&
        typeof body.error.code === 'string'
      )
        code = body.error.code
    } catch {}
    throw new WellnessApiError(code)
  }
  return response.status === 204 ? null : ((await response.json()) as unknown)
}
export async function fetchWellness(
  signal: AbortSignal,
): Promise<WellnessWorkspace> {
  const body = await request('', { signal })
  if (!object(body) || !object(body.wellness)) invalid()
  const value = body.wellness
  let profile: WellnessProfile | null = null
  if (value.profile !== null) {
    const p = value.profile
    if (
      !object(p) ||
      !optionalNumber(p.heightCm, 100, 250) ||
      !optionalNumber(p.targetWeightKg, 20, 350) ||
      !(
        p.activityLevel === null ||
        ACTIVITY_LEVELS.includes(
          p.activityLevel as (typeof ACTIVITY_LEVELS)[number],
        )
      )
    )
      invalid()
    profile = {
      heightCm: p.heightCm as number | null,
      targetWeightKg: p.targetWeightKg as number | null,
      activityLevel: p.activityLevel as WellnessProfile['activityLevel'],
    }
  }
  if (!Array.isArray(value.logs) || value.logs.length > 14) invalid()
  const logs = value.logs.map((log) => {
    if (
      !object(log) ||
      typeof log.id !== 'string' ||
      !date(log.loggedDate) ||
      !number(log.weightKg, 20, 350) ||
      !(log.note === null || typeof log.note === 'string')
    )
      invalid()
    return {
      id: log.id,
      loggedDate: log.loggedDate,
      weightKg: log.weightKg as number,
      note: log.note as string | null,
    }
  })
  const s = value.summary
  if (
    !object(s) ||
    !optionalNumber(s.currentWeightKg, 20, 350) ||
    !optionalNumber(s.previousWeightKg, 20, 350) ||
    !optionalNumber(s.changeKg, -330, 330) ||
    !optionalNumber(s.bmi, 0, 350) ||
    !optionalDate(s.currentLoggedDate) ||
    !optionalDate(s.previousLoggedDate)
  )
    invalid()
  function trend(v: unknown): WeightTrend | null {
    if (v === null) return null
    if (
      !object(v) ||
      !date(v.fromDate) ||
      !date(v.toDate) ||
      v.fromDate >= v.toDate ||
      !number(v.changeKg, -330, 330) ||
      !Number.isInteger(v.pointCount) ||
      (v.pointCount as number) < 2 ||
      (v.pointCount as number) > 30
    )
      invalid()
    return {
      fromDate: v.fromDate,
      toDate: v.toDate,
      changeKg: v.changeKg as number,
      pointCount: v.pointCount as number,
    }
  }
  return {
    profile,
    logs,
    summary: {
      currentWeightKg: s.currentWeightKg as number | null,
      currentLoggedDate: s.currentLoggedDate as string | null,
      previousWeightKg: s.previousWeightKg as number | null,
      previousLoggedDate: s.previousLoggedDate as string | null,
      changeKg: s.changeKg as number | null,
      bmi: s.bmi as number | null,
      trend7: trend(s.trend7),
      trend30: trend(s.trend30),
    },
  }
}
export async function saveWellnessProfile(profile: WellnessProfile) {
  await request('/profile', { method: 'PUT', body: JSON.stringify(profile) })
}
export async function saveWeight(
  id: string | null,
  value: Omit<WeightLog, 'id'>,
) {
  await request(`/logs${id ? `/${encodeURIComponent(id)}` : ''}`, {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(value),
  })
}
export async function deleteWeight(id: string) {
  await request(`/logs/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
export function wellnessError(error: unknown) {
  if (error instanceof WellnessApiError) {
    if (error.code === 'WELLNESS_DATE_EXISTS')
      return 'Ngày này đã có lần cân. Bạn đóng biểu mẫu và sửa lần cân đã có trong lịch sử nhé.'
    if (error.code === 'WELLNESS_NOT_FOUND')
      return 'Lần cân này không còn trong góc riêng của bạn. Bạn tải lại nhé.'
    if (error.code === 'WELLNESS_FORBIDDEN')
      return 'Thể trạng là góc riêng của mỗi bạn.'
    if (error.code === 'WELLNESS_INVALID')
      return 'Bạn kiểm tra ngày, chiều cao từ 100–250 cm và cân nặng từ 20–350 kg, tối đa hai chữ số thập phân nhé.'
    if (error.code === 'UNAUTHENTICATED')
      return 'Phiên đăng nhập đã hết. Bạn tải lại trang để vào nhà nhé.'
  }
  return 'Chưa thể cập nhật thể trạng. Bạn thử lại nhé.'
}
function object(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
function number(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
}
function optionalNumber(v: unknown, min: number, max: number) {
  return v === null || number(v, min, max)
}
function date(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v))
  )
}
function optionalDate(v: unknown) {
  return v === null || date(v)
}
function invalid(): never {
  throw new WellnessApiError('WELLNESS_UNAVAILABLE')
}
