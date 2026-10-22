import { ApiError } from '../errors/api-error.js'
import { validDate } from './calendar.service.js'
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
  latestAssessment: Assessment | null
}
export interface AssessmentData {
  courses: { id: string; name: string }[]
  assessments: Assessment[]
}
export function normalizeAssessment(input: unknown): AssessmentInput {
  if (
    !object(input) ||
    Object.keys(input).some(
      (k) =>
        ![
          'courseId',
          'title',
          'assessmentType',
          'score',
          'maxScore',
          'letterGrade',
          'weightPercent',
          'assessedAt',
          'note',
        ].includes(k),
    )
  )
    invalid()
  if (
    typeof input.courseId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.courseId,
    ) ||
    !ASSESSMENT_TYPES.includes(input.assessmentType as never)
  )
    invalid()
  const score = decimal(input.score, 0, 1000000),
    maxScore = decimal(input.maxScore, 0.0001, 1000000),
    weightPercent = decimal(input.weightPercent, 0, 100)
  if (score !== null && (maxScore === null || score > maxScore)) invalid()
  const assessedAt = input.assessedAt ?? null
  if (assessedAt !== null && !validDate(assessedAt)) invalid()
  return {
    courseId: input.courseId,
    title: text(input.title, 160),
    assessmentType: input.assessmentType as AssessmentInput['assessmentType'],
    score,
    maxScore,
    weightPercent,
    letterGrade: optionalText(input.letterGrade, 20),
    assessedAt: assessedAt as string | null,
    note: optionalText(input.note, 1000),
  }
}
export function assessmentPercentage(
  a: Pick<AssessmentInput, 'score' | 'maxScore'>,
) {
  return a.score === null || a.maxScore === null
    ? null
    : round((a.score / a.maxScore) * 100)
}
export function summarizeGrades(data: AssessmentData): GradeSummary[] {
  return data.courses.map((course) => {
    const rows = data.assessments
        .filter((a) => a.courseId === course.id)
        .sort(compareAssessments),
      numeric = rows.filter((a) => a.score !== null && a.maxScore !== null),
      weighted = numeric.filter((a) => a.weightPercent !== null)
    // Calculate from unrounded ratios; round only the final display values.
    const earned = weighted.reduce(
      (sum, a) => sum + (a.score! / a.maxScore!) * a.weightPercent!,
      0,
    )
    const units = weighted.reduce(
      (sum, a) => sum + Math.round(a.weightPercent! * 10000),
      0,
    )
    const weightState =
      units === 0
        ? 'NONE'
        : units < 1000000
          ? 'INCOMPLETE'
          : units === 1000000
            ? 'COMPLETE'
            : 'OVERALLOCATED'
    return {
      courseId: course.id,
      courseName: course.name,
      assessmentCount: rows.length,
      numericCount: numeric.length,
      averagePercent: numeric.length
        ? round(
            numeric.reduce(
              (sum, a) => sum + (a.score! / a.maxScore!) * 100,
              0,
            ) / numeric.length,
          )
        : null,
      weightedCoveragePercent: units / 10000,
      weightedEarnedPercent:
        units > 0 && units <= 1000000 ? round(earned) : null,
      weightState,
      latestAssessment: rows[0] ?? null,
    }
  })
}
export function compareAssessments(a: Assessment, b: Assessment) {
  return (
    (b.assessedAt ?? '').localeCompare(a.assessedAt ?? '') ||
    b.createdAt.localeCompare(a.createdAt) ||
    b.id.localeCompare(a.id)
  )
}
function round(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100
}
function decimal(value: unknown, min: number, max: number) {
  if (value === null || value === undefined) return null
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    Number(value.toFixed(4)) !== value
  )
    invalid()
  return value
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
  return value === null ||
    value === undefined ||
    (typeof value === 'string' && !value.trim())
    ? null
    : text(value, max)
}
function object(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
function invalid(): never {
  throw new ApiError(400, 'STUDY_INVALID', 'Invalid assessment input')
}
