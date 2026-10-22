import { ApiError } from '../errors/api-error.js'

export interface PracticeResultInput {
  sessionId: string
  metricTitle: string
  score: number
  maxScore: number
  note: string | null
}
export interface PracticeResult extends PracticeResultInput {
  id: string
  courseId: string
  courseName: string
  studiedAt: string
  createdAt: string
  updatedAt: string
}
export interface PracticeTrend {
  courseId: string
  courseName: string
  latest: PracticeResult | null
  previous: PracticeResult | null
  changePercentagePoints: number | null
  thisWeekAverage: number | null
  previousWeekAverage: number | null
  thisMonthAverage: number | null
  previousMonthAverage: number | null
  history: PracticeResult[]
}

export function normalizePracticeResult(input: unknown): PracticeResultInput {
  if (!object(input) || Object.keys(input).some((key) => !['sessionId', 'metricTitle', 'score', 'maxScore', 'note'].includes(key))) invalid()
  if (typeof input.sessionId !== 'string' || !uuid(input.sessionId)) invalid()
  if (typeof input.metricTitle !== 'string' || !input.metricTitle.trim() || input.metricTitle.trim().length > 120) invalid()
  const score = decimal(input.score, 0, 1000000)
  const maxScore = decimal(input.maxScore, 0.0001, 1000000)
  if (score === null || maxScore === null || score > maxScore) invalid()
  const note = input.note === null || input.note === undefined || input.note === '' ? null : input.note
  if (note !== null && (typeof note !== 'string' || !note.trim() || note.trim().length > 1000)) invalid()
  return { sessionId: input.sessionId, metricTitle: input.metricTitle.trim(), score, maxScore, note: note === null ? null : note.trim() }
}

export function practicePercentage(value: Pick<PracticeResultInput, 'score' | 'maxScore'>) {
  if (!Number.isFinite(value.maxScore) || value.maxScore <= 0 || !Number.isFinite(value.score) || value.score < 0 || value.score > value.maxScore) return null
  return round((value.score / value.maxScore) * 100)
}

export function summarizePractice(results: PracticeResult[], today: string): PracticeTrend[] {
  const groups = new Map<string, PracticeResult[]>()
  for (const row of results) {
    const list = groups.get(row.courseId) ?? []
    list.push(row)
    groups.set(row.courseId, list)
  }
  const weekStart = shift(today, -(weekday(today) - 1))
  const previousWeekStart = shift(weekStart, -7)
  const monthStart = `${today.slice(0, 7)}-01`
  const previousMonthStart = shift(monthStart, -new Date(`${monthStart}T12:00:00Z`).getUTCDate())
  return [...groups.values()].map((rows) => {
    const history = [...rows].sort((a, b) => a.studiedAt.localeCompare(b.studiedAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    const latestFirst = [...history].reverse()
    const average = (from: string, to: string) => {
      const values = rows.filter((row) => row.studiedAt >= from && row.studiedAt <= to).map(practicePercentage).filter((v): v is number => v !== null)
      return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null
    }
    const latest = latestFirst[0] ?? null
    const previous = latestFirst[1] ?? null
    const latestPercent = latest ? practicePercentage(latest) : null
    const previousPercent = previous ? practicePercentage(previous) : null
    return {
      courseId: rows[0]!.courseId,
      courseName: rows[0]!.courseName,
      latest,
      previous,
      changePercentagePoints: latestPercent === null || previousPercent === null ? null : round(latestPercent - previousPercent),
      thisWeekAverage: average(weekStart, today),
      previousWeekAverage: average(previousWeekStart, shift(weekStart, -1)),
      thisMonthAverage: average(monthStart, today),
      previousMonthAverage: average(previousMonthStart, shift(monthStart, -1)),
      history,
    }
  }).sort((a, b) => a.courseName.localeCompare(b.courseName) || a.courseId.localeCompare(b.courseId))
}

function shift(date: string, days: number) { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10) }
function weekday(date: string) { return new Date(`${date}T12:00:00Z`).getUTCDay() || 7 }
function uuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) }
function decimal(value: unknown, min: number, max: number) { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || Number(value.toFixed(4)) !== value) invalid(); return value }
function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100 }
function object(value: unknown): value is Record<string, any> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function invalid(): never { throw new ApiError(400, 'STUDY_INVALID', 'Invalid practice result') }
