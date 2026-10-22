import { describe, expect, it } from 'vitest'
import { activityProgress } from '../src/services/activity-progress.js'
describe('completed activity progress and scheduled consistency', () => {
  it('counts actual completions, not scheduled time, across family date boundaries', () => {
    const result = activityProgress('2026-03-02', [{ date: '2026-03-02', minutes: 90 }, { date: '2026-03-01', minutes: 60 }, { date: '2026-02-24', minutes: 30 }], [
      { id: 'pending', endsAt: '2026-03-03T12:00Z', completedAt: null, cancelled: false },
    ], new Date('2026-03-02T15:00Z'))
    expect(result.today).toEqual({ minutes: 90, sessions: 1 })
    expect(result.week).toEqual({ minutes: 90, sessions: 1, previousMinutes: 90, previousSessions: 2, differenceMinutes: 0, differenceSessions: -1, percentage: 0 })
    expect(result.month).toEqual({ minutes: 150, sessions: 2, previousMinutes: 30, previousSessions: 1, differenceMinutes: 120, differenceSessions: 1, percentage: 400 })
    expect(result.consistency).toEqual({ planned: 1, completed: 0, streak: 0 })
  })
  it('does not invent percentages when previous period has no completed duration', () => {
    const result = activityProgress('2026-01-01', [{ date: '2025-12-29', minutes: 120 }, { date: '2026-01-01', minutes: 90 }], [], new Date('2026-01-01T13:00Z'))
    expect(result.week.percentage).toBeNull()
    expect(result.month.percentage).toBe(-25)
    expect(result.month.previousMinutes).toBe(120)
  })
  it('rest days do not break consecutive scheduled completions and future plans do not count as misses', () => {
    const schedule = ['2026-03-02', '2026-03-04', '2026-03-06'].map((date, index) => ({ id: String(index), endsAt: `${date}T12:00Z`, completedAt: `${date}T13:00Z`, cancelled: false }))
    const result = activityProgress('2026-03-08', [], [...schedule, { id: 'future', endsAt: '2026-03-09T12:00Z', completedAt: null, cancelled: false }], new Date('2026-03-08T05:00Z'))
    expect(result.consistency).toEqual({ planned: 3, completed: 3, streak: 3 })
  })
  it('only due incomplete or late completed sessions break streak; cancelled-before-due plans do not', () => {
    const result = activityProgress('2026-03-08', [], [
      { id: '1', endsAt: '2026-03-02T12:00Z', completedAt: '2026-03-02T13:00Z', cancelled: false },
      { id: '2', endsAt: '2026-03-03T12:00Z', completedAt: null, cancelled: false },
      { id: '3', endsAt: '2026-03-05T12:00Z', completedAt: '2026-03-05T13:00Z', cancelled: false },
      { id: '4', endsAt: '2026-03-06T12:00Z', completedAt: null, cancelled: true },
      { id: '5', endsAt: '2026-03-08T12:00Z', completedAt: null, cancelled: false },
    ], new Date('2026-03-08T13:00Z'))
    expect(result.consistency).toEqual({ planned: 4, completed: 2, streak: 1 })
  })
  it('a session rescheduled before due is judged only at the new time', () => {
    const result = activityProgress('2026-03-08', [], [{ id: 'same-id', endsAt: '2026-03-09T12:00Z', completedAt: null, cancelled: false }], new Date('2026-03-08T13:00Z'))
    expect(result.consistency.streak).toBe(0)
    expect(result.consistency.planned).toBe(0)
  })
})
