export type ActivityKind = 'STUDY' | 'FITNESS'
export interface ActivityPlanInput { requestId: string; title: string; startsAt: string; endsAt: string; courseId: string | null; note: string | null }
export interface ActivityPlan extends ActivityPlanInput { id: string; kind: ActivityKind; completedAt: string | null; actualMinutes: number | null; completionNote: string | null; cancelled: boolean }
interface Totals { minutes: number; sessions: number }
interface ComparedTotals extends Totals { previousMinutes: number; previousSessions: number; differenceMinutes: number; differenceSessions: number; percentage: number | null }
export interface ActivityProgress { today: Totals; week: ComparedTotals; month: ComparedTotals; consistency: { planned: number; completed: number; streak: number } }
export interface ActivityView { plans: ActivityPlan[]; progress: ActivityProgress }
class ActivityApiError extends Error { code: string; constructor(code: string) { super('Activity request failed'); this.code = code } }
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch('/api/personal-activities' + path, { ...init, credentials: 'same-origin', headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) } })
  if (!response.ok) {
    let code = ''
    try { const data: unknown = await response.json(); if (object(data) && object(data.error) && typeof data.error.code === 'string') code = data.error.code } catch { /* Safe fallback for proxy errors. */ }
    throw new ActivityApiError(code)
  }
  return response.status === 204 ? null : await response.json() as unknown
}
export async function fetchActivities(kind: ActivityKind, signal: AbortSignal, id?: string): Promise<ActivityView> {
  const data = await request('?' + new URLSearchParams({ kind, ...(id ? { id } : {}) }), { signal })
  if (!object(data) || !object(data.activities) || !Array.isArray(data.activities.plans) || !validActivityProgress(data.activities.progress)) throw new Error('Invalid activity response')
  const plans = data.activities.plans.map(p => {
    if (!object(p) || typeof p.id !== 'string' || p.kind !== kind || typeof p.title !== 'string' || !stamp(p.startsAt) || !stamp(p.endsAt) || !nullable(p.courseId) || !nullable(p.note) || !nullable(p.completionNote) || !(p.completedAt === null || stamp(p.completedAt)) || !(p.actualMinutes === null || count(p.actualMinutes)) || typeof p.cancelled !== 'boolean') throw new Error('Invalid activity plan')
    return { id: p.id, requestId: p.id, kind, title: p.title, startsAt: p.startsAt, endsAt: p.endsAt, courseId: p.courseId as string | null, note: p.note as string | null, completedAt: p.completedAt as string | null, actualMinutes: p.actualMinutes as number | null, completionNote: p.completionNote as string | null, cancelled: p.cancelled }
  })
  return { plans, progress: data.activities.progress }
}
export async function saveActivity(kind: ActivityKind, input: ActivityPlanInput, id: string | null) { await request(`${id ? '/' + encodeURIComponent(id) : ''}?kind=${kind}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(input) }); changed() }
export async function completeActivity(id: string, durationMinutes: number, note: string | null, correct: boolean) { await request(`/${encodeURIComponent(id)}/completion`, { method: correct ? 'PATCH' : 'POST', body: JSON.stringify({ durationMinutes, note }) }); changed() }
export async function cancelActivity(id: string) { await request('/' + encodeURIComponent(id), { method: 'DELETE' }); changed() }
function changed() { window.dispatchEvent(new Event('family-activity-changed')) }
export function activityError(error: unknown) {
  if (error instanceof ActivityApiError) {
    if (error.code === 'ACTIVITY_CONFLICT') return 'Buổi này đã thay đổi hoặc đã qua hạn đổi lịch. Bạn tải lại để giữ đúng lịch sử nhé.'
    if (error.code === 'ACTIVITY_FORBIDDEN' || error.code === 'ACTIVITY_NOT_FOUND') return 'Bạn chỉ có thể mở và cập nhật buổi của mình.'
    if (error.code === 'ACTIVITY_INVALID') return 'Bạn kiểm tra lại ngày, giờ và thời lượng thực tế từ 1–1440 phút nhé.'
    if (error.code === 'UNAUTHENTICATED') return 'Phiên đăng nhập đã hết. Bạn tải lại trang để vào nhà nhé.'
  }
  return 'Chưa cập nhật được kế hoạch. Bạn thử lại nhé.'
}
function object(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v) }
function nullable(v: unknown) { return v === null || typeof v === 'string' }
function count(v: unknown): v is number { return Number.isSafeInteger(v) && (v as number) >= 0 }
function stamp(v: unknown): v is string { return typeof v === 'string' && Number.isFinite(Date.parse(v)) }
export function validActivityProgress(v: unknown): v is ActivityProgress {
  if (!object(v) || !object(v.today) || !count(v.today.minutes) || !count(v.today.sessions) || !object(v.consistency) || !['planned','completed','streak'].every(k => count((v.consistency as Record<string, unknown>)[k]))) return false
  return ['week','month'].every(k => { const p = v[k]; return object(p) && ['minutes','sessions','previousMinutes','previousSessions'].every(key => count(p[key])) && ['differenceMinutes','differenceSessions'].every(key => Number.isSafeInteger(p[key])) && (p.percentage === null || (typeof p.percentage === 'number' && Number.isFinite(p.percentage))) })
}
