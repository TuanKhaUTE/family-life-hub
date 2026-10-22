import { studyRequest, StudyApiError, studyError } from './study-api'
export const ASSESSMENT_TYPES = [
  'QUIZ',
  'ASSIGNMENT',
  'MIDTERM',
  'FINAL',
  'PROJECT',
  'PRESENTATION',
  'OTHER',
] as const
export interface AssessmentInput {
  courseId: string
  title: string
  assessmentType: (typeof ASSESSMENT_TYPES)[number]
  score: number | null
  maxScore: number | null
  letterGrade: string | null
  weightPercent: number | null
  assessedAt: string | null
  note: string | null
}
export interface Assessment extends AssessmentInput {
  id: string
  percentage: number | null
  createdAt: string
  updatedAt: string
}
export interface GradeSummary {
  courseId: string
  courseName: string
  assessmentCount: number
  numericCount: number
  averagePercent: number | null
  weightedCoveragePercent: number
  weightedEarnedPercent: number | null
  weightState: 'NONE' | 'INCOMPLETE' | 'COMPLETE' | 'OVERALLOCATED'
  latestAssessment: Omit<Assessment, 'percentage'> | null
}
export interface GradeView {
  courses: { id: string; name: string }[]
  assessments: Assessment[]
  summaries: GradeSummary[]
}
export async function fetchGrades(
  courseId: string | null,
  signal: AbortSignal,
): Promise<GradeView> {
  const body = await studyRequest(
    `/assessments${courseId ? `?${new URLSearchParams({ courseId })}` : ''}`,
    { signal },
  )
  if (!object(body) || !object(body.grades)) invalid()
  const g = body.grades
  if (
    !Array.isArray(g.courses) ||
    !Array.isArray(g.assessments) ||
    !Array.isArray(g.summaries)
  )
    invalid()
  return {
    courses: g.courses.map((c) => {
      if (!object(c) || typeof c.id !== 'string' || typeof c.name !== 'string')
        invalid()
      return { id: c.id, name: c.name }
    }),
    assessments: g.assessments.map((a) => {
      const row = readAssessment(a)
      if (!object(a) || !nullableNumber(a.percentage)) invalid()
      return { ...row, percentage: a.percentage as number | null }
    }),
    summaries: g.summaries.map((s) => {
      if (
        !object(s) ||
        typeof s.courseId !== 'string' ||
        typeof s.courseName !== 'string' ||
        !count(s.assessmentCount) ||
        !count(s.numericCount) ||
        !nullableNumber(s.averagePercent) ||
        !number(s.weightedCoveragePercent) ||
        !nullableNumber(s.weightedEarnedPercent) ||
        !['NONE', 'INCOMPLETE', 'COMPLETE', 'OVERALLOCATED'].includes(
          String(s.weightState),
        )
      )
        invalid()
      return {
        courseId: s.courseId,
        courseName: s.courseName,
        assessmentCount: s.assessmentCount,
        numericCount: s.numericCount,
        averagePercent: s.averagePercent as number | null,
        weightedCoveragePercent: s.weightedCoveragePercent,
        weightedEarnedPercent: s.weightedEarnedPercent as number | null,
        weightState: s.weightState as GradeSummary['weightState'],
        latestAssessment:
          s.latestAssessment === null
            ? null
            : readAssessment(s.latestAssessment),
      }
    }),
  }
}
function readAssessment(v: unknown): Omit<Assessment, 'percentage'> {
  if (
    !object(v) ||
    typeof v.id !== 'string' ||
    typeof v.courseId !== 'string' ||
    typeof v.title !== 'string' ||
    !ASSESSMENT_TYPES.includes(v.assessmentType as never) ||
    !nullableNumber(v.score) ||
    !nullableNumber(v.maxScore) ||
    !nullableNumber(v.weightPercent) ||
    !nullableText(v.letterGrade) ||
    !nullableText(v.assessedAt) ||
    !nullableText(v.note) ||
    typeof v.createdAt !== 'string' ||
    typeof v.updatedAt !== 'string'
  )
    invalid()
  return {
    id: v.id,
    courseId: v.courseId,
    title: v.title,
    assessmentType: v.assessmentType as AssessmentInput['assessmentType'],
    score: v.score as number | null,
    maxScore: v.maxScore as number | null,
    letterGrade: v.letterGrade as string | null,
    weightPercent: v.weightPercent as number | null,
    assessedAt: v.assessedAt as string | null,
    note: v.note as string | null,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  }
}
export function gradesError(error: unknown) {
  if (error instanceof StudyApiError && error.code === 'STUDY_INVALID')
    return 'Bạn kiểm tra điểm đạt được, điểm tối đa lớn hơn 0 và trọng số từ 0 đến 100% nhé.'
  return error instanceof StudyApiError
    ? studyError(error)
    : 'Chưa thể cập nhật điểm. Bạn thử lại nhé.'
}
function object(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
function number(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
}
function count(v: unknown): v is number {
  return number(v) && Number.isInteger(v)
}
function nullableNumber(v: unknown) {
  return v === null || number(v)
}
function nullableText(v: unknown) {
  return v === null || typeof v === 'string'
}
function invalid(): never {
  throw new StudyApiError('STUDY_UNAVAILABLE')
}
