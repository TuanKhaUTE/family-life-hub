import { ApiError } from '../errors/api-error.js'
import type { SafeFamilyProfile } from './family-auth.service.js'
import { getFamilyDate } from '../time/family-calendar.js'
import { validDate } from './calendar.service.js'
import {
  normalizeAssessment,
  summarizeGrades,
  compareAssessments,
  assessmentPercentage,
  type AssessmentInput,
  type AssessmentData,
  type Assessment,
} from './study-assessment.js'
export const STUDY_KINDS = [
  'semesters',
  'courses',
  'goals',
  'sessions',
  'assessments',
] as const
export type StudyKind = (typeof STUDY_KINDS)[number]
export type StudyInput =
  | AssessmentInput
  | { name: string; startDate: string; endDate: string; isActive: boolean }
  | { semesterId: string; name: string; code: string | null }
  | {
      courseId: string | null
      title: string
      targetMinutes: number | null
      targetDate: string | null
      status: 'ACTIVE' | 'COMPLETED'
    }
  | {
      courseId: string | null
      studiedAt: string
      durationMinutes: number
      note: string | null
    }
export interface StudySemester {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
}
export interface StudyCourse {
  id: string
  semesterId: string
  name: string
  code: string | null
}
export interface StudyGoal {
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
  semesters: StudySemester[]
  courses: StudyCourse[]
  goals: StudyGoal[]
  sessions: StudySession[]
  summary: StudySummary
}
export interface StudyRepository {
  readAssessments(
    actorId: string,
    courseId: string | null,
  ): Promise<AssessmentData>
  read(actorId: string, today: string): Promise<StudyWorkspace>
  mutate(
    actorId: string,
    kind: StudyKind,
    id: string | null,
    input: StudyInput | null,
    remove: boolean,
  ): Promise<void>
}
export class StudyService {
  constructor(
    private readonly repository: StudyRepository,
    private readonly clock = () => new Date(),
  ) {}
  async read(actor: SafeFamilyProfile) {
    allowed(actor)
    return this.run(() =>
      this.repository.read(actor.id, getFamilyDate(this.clock())),
    )
  }
  async assessments(actor: SafeFamilyProfile, courseId: unknown = undefined) {
    allowed(actor)
    if (courseId !== undefined) studyId(courseId)
    const data = await this.run(() =>
      this.repository.readAssessments(
        actor.id,
        (courseId as string | undefined) ?? null,
      ),
    )
    return {
      ...data,
      assessments: data.assessments.map((a) => ({
        ...a,
        percentage: assessmentPercentage(a),
      })),
      summaries: summarizeGrades(data),
    }
  }
  async summary(
    actor: SafeFamilyProfile,
  ): Promise<
    StudySummary & {
      latestAssessment?: { courseName: string; assessment: Assessment } | null
    }
  > {
    const [workspace, grades] = await Promise.all([
      this.read(actor),
      this.assessments(actor),
    ])
    const latest = [...grades.assessments].sort(compareAssessments)[0]
    return {
      ...workspace.summary,
      latestAssessment: latest
        ? {
            courseName: grades.courses.find((c) => c.id === latest.courseId)!
              .name,
            assessment: latest,
          }
        : null,
    }
  }
  async save(
    actor: SafeFamilyProfile,
    kind: unknown,
    id: unknown,
    input: unknown,
  ) {
    allowed(actor)
    const k = kindValue(kind)
    if (id !== null) studyId(id)
    const data = normalizeStudy(k, input, getFamilyDate(this.clock()))
    await this.run(() =>
      this.repository.mutate(actor.id, k, id as string | null, data, false),
    )
  }
  async remove(actor: SafeFamilyProfile, kind: unknown, id: unknown) {
    allowed(actor)
    const k = kindValue(kind)
    studyId(id)
    await this.run(() => this.repository.mutate(actor.id, k, id, null, true))
  }
  private async run<T>(action: () => Promise<T>) {
    try {
      return await action()
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        503,
        'STUDY_UNAVAILABLE',
        'Study is temporarily unavailable',
      )
    }
  }
}
function allowed(actor: SafeFamilyProfile) {
  if (!['ADMIN', 'MEMBER'].includes(actor.role))
    throw new ApiError(
      403,
      'STUDY_FORBIDDEN',
      'Study workspace is private and unavailable for this role',
    )
}
function kindValue(value: unknown): StudyKind {
  if (!STUDY_KINDS.includes(value as StudyKind)) invalid()
  return value as StudyKind
}
export function studyId(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    invalid()
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
function optionalText(value: unknown, max: number) {
  return value === null || value === undefined || value === ''
    ? null
    : text(value, max)
}
function course(value: unknown) {
  if (value === null || value === undefined) return null
  studyId(value)
  return value
}
function date(value: unknown): string {
  if (!validDate(value)) invalid()
  return value
}
function integer(value: unknown, max: number) {
  if (
    !Number.isInteger(value) ||
    (value as number) < 1 ||
    (value as number) > max
  )
    invalid()
  return value as number
}
export function normalizeStudy(
  kind: StudyKind,
  input: unknown,
  today: string,
): StudyInput {
  if (kind === 'assessments') return normalizeAssessment(input)
  if (input === null || typeof input !== 'object' || Array.isArray(input))
    invalid()
  const v = input as Record<string, unknown>
  const keys = {
    semesters: ['name', 'startDate', 'endDate', 'isActive'],
    courses: ['name', 'semesterId', 'code'],
    goals: ['title', 'courseId', 'targetMinutes', 'targetDate', 'status'],
    sessions: ['courseId', 'studiedAt', 'durationMinutes', 'note'],
  }[kind]
  if (Object.keys(v).some((k) => !keys.includes(k))) invalid()
  if (kind === 'semesters') {
    const startDate = date(v.startDate),
      endDate = date(v.endDate)
    if (endDate < startDate || typeof v.isActive !== 'boolean') invalid()
    return { name: text(v.name, 120), startDate, endDate, isActive: v.isActive }
  }
  if (kind === 'courses') {
    studyId(v.semesterId)
    return {
      semesterId: v.semesterId,
      name: text(v.name, 120),
      code: optionalText(v.code, 40),
    }
  }
  if (kind === 'goals') {
    if (!['ACTIVE', 'COMPLETED'].includes(String(v.status))) invalid()
    return {
      title: text(v.title, 160),
      courseId: course(v.courseId),
      targetMinutes:
        v.targetMinutes === null || v.targetMinutes === undefined
          ? null
          : integer(v.targetMinutes, 10080),
      targetDate:
        v.targetDate === null || v.targetDate === undefined
          ? null
          : date(v.targetDate),
      status: v.status as 'ACTIVE' | 'COMPLETED',
    }
  }
  const studiedAt = date(v.studiedAt)
  if (studiedAt > today) invalid()
  return {
    courseId: course(v.courseId),
    studiedAt,
    durationMinutes: integer(v.durationMinutes, 1440),
    note: optionalText(v.note, 1000),
  }
}
function invalid(): never {
  throw new ApiError(400, 'STUDY_INVALID', 'Invalid Study input')
}
