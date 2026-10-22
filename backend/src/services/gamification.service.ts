import type { FamilyMemberRole } from './family-auth.service.js'

export type BreakfastGamificationState =
  | 'NO_RESPONSE'
  | 'SELECTED'
  | 'CUSTOM'
  | 'NOT_EATING'

export interface BreakfastStreakRecord {
  date: string
  state: BreakfastGamificationState
  deadlineAt: string
}

export interface DutyCompletionRecord {
  assigneeId: string | null
  completedAt: string | null
  cancelled: boolean
}

export interface MealAchievementDish {
  id: string
  name: string
  mealDate: string
  averageRating: number | null
  ratingCount: number
  ownRating: number | null
}

export interface MealAchievement {
  key: 'feedback' | 'favorite'
  label: string
}

const successfulBreakfastStates = new Set<BreakfastGamificationState>([
  'SELECTED',
  'CUSTOM',
  'NOT_EATING',
])

/**
 * Counts the current run of completed breakfast responses. A response only
 * counts after its family-time deadline; NO_RESPONSE and missing dates break
 * the run. This keeps the metric derived from persisted selections.
 */
export function calculateBreakfastStreak(
  records: BreakfastStreakRecord[],
  now: Date,
): number {
  const closed = records
    .filter((record) => Date.parse(record.deadlineAt) <= now.getTime())
    .sort((a, b) => b.date.localeCompare(a.date))
  if (!closed.length) return 0

  let streak = 0
  let expected = closed[0]!.date
  for (const record of closed) {
    if (record.date !== expected) break
    if (!successfulBreakfastStates.has(record.state)) break
    streak += 1
    expected = shiftDate(expected, -1)
  }
  return streak
}

export function countRecentDutyCompletions(
  records: DutyCompletionRecord[],
  memberId: string,
): number {
  return records.filter(
    (record) =>
      record.assigneeId === memberId &&
      record.completedAt !== null &&
      !record.cancelled,
  ).length
}

export function deriveMealAchievements(
  role: FamilyMemberRole,
  dishes: MealAchievementDish[],
): MealAchievement[] {
  if (role === 'PARENT') {
    return dishes.some(
      (dish) =>
        dish.ratingCount >= 3 &&
        dish.averageRating !== null &&
        dish.averageRating >= 4.5,
    )
      ? [{ key: 'favorite', label: 'Món cả nhà yêu thích' }]
      : []
  }

  const meaningfulRatings = dishes.filter((dish) => dish.ownRating !== null)
  return meaningfulRatings.length >= 3
    ? [{ key: 'feedback', label: 'Người góp ý nhiệt tình' }]
    : []
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
