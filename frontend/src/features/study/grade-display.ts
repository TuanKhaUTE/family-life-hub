import type { AssessmentInput } from './grades-api'
export const ASSESSMENT_LABELS = {
  QUIZ: 'Kiểm tra ngắn',
  ASSIGNMENT: 'Bài tập',
  MIDTERM: 'Giữa kỳ',
  FINAL: 'Cuối kỳ',
  PROJECT: 'Đồ án',
  PRESENTATION: 'Thuyết trình',
  OTHER: 'Khác',
}
export function gradeNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 }).format(
    value,
  )
}
export function gradeScore(
  a: Pick<AssessmentInput, 'score' | 'maxScore' | 'letterGrade'>,
) {
  return a.score !== null && a.maxScore !== null
    ? `${gradeNumber(a.score)}/${gradeNumber(a.maxScore)}`
    : (a.letterGrade ?? 'Chưa có điểm số')
}
export function gradeDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value + 'T12:00:00Z'))
}
