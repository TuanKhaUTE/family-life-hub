import { getFamilyDate, familyDateTimeToUtc } from '../time/family-calendar.js'
export interface CompletionFact { date: string; minutes: number | null }
export interface ScheduleFact { id: string; endsAt: string; completedAt: string | null; cancelled: boolean }
function shift(date: string, days: number) { const d = new Date(date + 'T12:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10) }
export function activityProgress(today: string, facts: CompletionFact[], schedule: ScheduleFact[], now: Date) {
  const start = shift(today, -(new Date(today + 'T12:00Z').getUTCDay() || 7) + 1)
  const month = today.slice(0, 7) + '-01'
  const priorMonthEnd = shift(month, -1), priorMonth = priorMonthEnd.slice(0, 7) + '-01'
  const monthEnd = new Date(month + 'T12:00Z'); monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1)
  const sum = (from: string, to: string) => {
    const completed = facts.filter(f => f.date >= from && f.date <= to && f.date <= today)
    return { minutes: completed.reduce((total, f) => total + (f.minutes ?? 0), 0), sessions: completed.length }
  }
  const compare = (from: string, to: string, previousFrom: string, previousTo: string) => {
    const current = sum(from, to), previous = sum(previousFrom, previousTo)
    return { ...current, previousMinutes: previous.minutes, previousSessions: previous.sessions, differenceMinutes: current.minutes - previous.minutes, differenceSessions: current.sessions - previous.sessions, percentage: previous.minutes ? Math.round((current.minutes - previous.minutes) * 1000 / previous.minutes) / 10 : null }
  }
  const active = schedule.filter(s => !s.cancelled)
  let streak = 0
  for (const s of [...active].sort((a, b) => a.endsAt.localeCompare(b.endsAt) || a.id.localeCompare(b.id))) {
    const due = familyDateTimeToUtc(shift(getFamilyDate(new Date(s.endsAt)), 1), 0).getTime()
    if (!s.completedAt && now.getTime() < due) continue
    streak = s.completedAt && Date.parse(s.completedAt) < due ? streak + 1 : 0
  }
  const weekly = active.filter(s => { const date = getFamilyDate(new Date(s.endsAt)); return date >= start && date <= shift(start, 6) })
  return { today: sum(today, today), week: compare(start, shift(start, 6), shift(start, -7), shift(start, -1)), month: compare(month, shift(monthEnd.toISOString().slice(0, 10), -1), priorMonth, priorMonthEnd), consistency: { planned: weekly.length, completed: weekly.filter(s => s.completedAt !== null).length, streak } }
}
export type ActivityProgress = ReturnType<typeof activityProgress>
