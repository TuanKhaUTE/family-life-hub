export type StudyKind = 'semesters' | 'courses' | 'goals' | 'sessions'
export interface Semester {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
}
export interface Course {
  id: string
  semesterId: string
  name: string
  code: string | null
}
export interface Goal {
  id: string
  courseId: string | null
  title: string
  targetMinutes: number | null
  targetDate: string | null
  status: 'ACTIVE' | 'COMPLETED'
}
export interface StudySession {
  id: string
  courseId: string | null
  studiedAt: string
  durationMinutes: number
  note: string | null
}
export interface StudySummary {
  weekStart: string
  weekEnd: string
  totalMinutes: number
  sessionCount: number
  goals: {
    id: string
    title: string
    targetMinutes: number | null
    minutes: number
    targetDate: string | null
  }[]
  courses: { courseId: string | null; name: string; minutes: number }[]
}
export interface StudyWorkspace {
  semesters: Semester[]
  courses: Course[]
  goals: Goal[]
  sessions: StudySession[]
  summary: StudySummary
}
export type StudyRecord = Semester | Course | Goal | StudySession
export class StudyApiError extends Error {
  readonly code: string
  constructor(code: string) {
    super('Study unavailable')
    this.code = code
  }
}
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`/api/study${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (!response.ok) {
    let code = 'STUDY_UNAVAILABLE'
    try {
      const body: unknown = await response.json()
      if (
        object(body) &&
        object(body.error) &&
        typeof body.error.code === 'string'
      )
        code = body.error.code
    } catch {}
    throw new StudyApiError(code)
  }
  return response.status === 204 ? null : ((await response.json()) as unknown)
}
export async function fetchStudy(signal: AbortSignal): Promise<StudyWorkspace> {
  const body = await request('', { signal })
  if (!object(body) || !object(body.study)) invalid()
  const s = body.study
  if (
    !Array.isArray(s.semesters) ||
    !Array.isArray(s.courses) ||
    !Array.isArray(s.goals) ||
    !Array.isArray(s.sessions) ||
    !validSummary(s.summary)
  )
    invalid()
  return {
    semesters: s.semesters.map((v) => {
      if (
        !record(v) ||
        !text(v.name) ||
        !day(v.startDate) ||
        !day(v.endDate) ||
        typeof v.isActive !== 'boolean'
      )
        invalid()
      return {
        id: v.id,
        name: v.name,
        startDate: v.startDate,
        endDate: v.endDate,
        isActive: v.isActive,
      }
    }),
    courses: s.courses.map((v) => {
      if (
        !record(v) ||
        !text(v.name) ||
        !text(v.semesterId) ||
        !nullable(v.code)
      )
        invalid()
      return {
        id: v.id,
        name: v.name,
        semesterId: v.semesterId,
        code: v.code as string | null,
      }
    }),
    goals: s.goals.map((v) => {
      if (
        !record(v) ||
        !text(v.title) ||
        !nullable(v.courseId) ||
        !(v.targetMinutes === null || count(v.targetMinutes)) ||
        !(v.targetDate === null || day(v.targetDate)) ||
        !['ACTIVE', 'COMPLETED'].includes(String(v.status))
      )
        invalid()
      return {
        id: v.id,
        title: v.title,
        courseId: v.courseId as string | null,
        targetMinutes: v.targetMinutes as number | null,
        targetDate: v.targetDate as string | null,
        status: v.status as Goal['status'],
      }
    }),
    sessions: s.sessions.map((v) => {
      if (
        !record(v) ||
        !day(v.studiedAt) ||
        !nullable(v.courseId) ||
        !count(v.durationMinutes) ||
        !nullable(v.note)
      )
        invalid()
      return {
        id: v.id,
        courseId: v.courseId as string | null,
        studiedAt: v.studiedAt,
        durationMinutes: v.durationMinutes,
        note: v.note as string | null,
      }
    }),
    summary: readSummary(s.summary),
  }
}
export async function saveStudy(
  kind: StudyKind | 'assessments',
  id: string | null,
  input: unknown,
) {
  await request(`/${kind}${id ? `/${encodeURIComponent(id)}` : ''}`, {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(input),
  })
}
export async function deleteStudy(kind: StudyKind | 'assessments', id: string) {
  await request(`/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
export { request as studyRequest }
export function studyError(error: unknown) {
  if (error instanceof StudyApiError) {
    if (error.code === 'STUDY_IN_USE')
      return 'Mục này đang gắn với môn học, mục tiêu hoặc buổi học. Bạn chuyển liên kết hoặc xóa các mục liên quan trước nhé.'
    if (error.code === 'STUDY_NOT_FOUND')
      return 'Mục này không còn trong góc học tập của bạn. Bạn tải lại để xem thông tin mới nhé.'
    if (error.code === 'STUDY_INVALID')
      return 'Bạn kiểm tra tên, ngày và thời lượng học nhé. Chỉ ghi buổi học đã diễn ra, từ 1 đến 1.440 phút.'
    if (error.code === 'UNAUTHENTICATED')
      return 'Phiên đăng nhập đã hết. Bạn tải lại trang để vào nhà nhé.'
    if (error.code === 'STUDY_FORBIDDEN')
      return 'Đây là góc học tập riêng của mỗi bạn.'
  }
  return 'Chưa thể cập nhật góc học tập. Bạn thử lại nhé.'
}
export function validSummary(v: unknown): v is StudySummary {
  return (
    object(v) &&
    day(v.weekStart) &&
    day(v.weekEnd) &&
    count(v.totalMinutes) &&
    count(v.sessionCount) &&
    Array.isArray(v.goals) &&
    v.goals.every(
      (g) =>
        record(g) &&
        text(g.title) &&
        count(g.minutes) &&
        (g.targetMinutes === null || count(g.targetMinutes)) &&
        (g.targetDate === null || day(g.targetDate)),
    ) &&
    Array.isArray(v.courses) &&
    v.courses.every(
      (c) =>
        object(c) && nullable(c.courseId) && text(c.name) && count(c.minutes),
    )
  )
}
export function readSummary(v: StudySummary): StudySummary {
  return {
    weekStart: v.weekStart,
    weekEnd: v.weekEnd,
    totalMinutes: v.totalMinutes,
    sessionCount: v.sessionCount,
    goals: v.goals.map((g) => ({
      id: g.id,
      title: g.title,
      targetMinutes: g.targetMinutes,
      targetDate: g.targetDate,
      minutes: g.minutes,
    })),
    courses: v.courses.map((c) => ({
      courseId: c.courseId,
      name: c.name,
      minutes: c.minutes,
    })),
  }
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
function nullable(v: unknown) {
  return v === null || text(v)
}
function count(v: unknown): v is number {
  return Number.isSafeInteger(v) && (v as number) >= 0
}
function day(v: unknown): v is string {
  return (
    text(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v))
  )
}
function invalid(): never {
  throw new StudyApiError('STUDY_UNAVAILABLE')
}
