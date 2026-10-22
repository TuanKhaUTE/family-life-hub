import { describe, expect, it } from 'vitest'
import {
  calculateBreakfastStreak,
  countRecentDutyCompletions,
  deriveMealAchievements,
} from '../src/services/gamification.service.js'

describe('breakfast gamification', () => {
  it('counts consecutive closed breakfast days for selected, custom, and not-eating responses', () => {
    const now = new Date('2099-05-05T02:00:00Z')
    expect(
      calculateBreakfastStreak(
        [
          { date: '2099-05-01', state: 'SELECTED', deadlineAt: '2099-05-01T18:00:00Z' },
          { date: '2099-05-02', state: 'CUSTOM', deadlineAt: '2099-05-02T18:00:00Z' },
          { date: '2099-05-03', state: 'NOT_EATING', deadlineAt: '2099-05-03T18:00:00Z' },
          { date: '2099-05-04', state: 'NO_RESPONSE', deadlineAt: '2099-05-04T18:00:00Z' },
        ],
        now,
      ),
    ).toBe(0)
  })

  it('does not count an open breakfast day before the family-time deadline', () => {
    expect(
      calculateBreakfastStreak(
        [
          { date: '2099-05-04', state: 'SELECTED', deadlineAt: '2099-05-04T18:00:00Z' },
        ],
        new Date('2099-05-04T17:59:59Z'),
      ),
    ).toBe(0)
  })

  it('counts a completed streak after the 01:00 local deadline', () => {
    expect(
      calculateBreakfastStreak(
        [
          { date: '2099-05-03', state: 'SELECTED', deadlineAt: '2099-05-03T18:00:00Z' },
          { date: '2099-05-04', state: 'NOT_EATING', deadlineAt: '2099-05-04T18:00:00Z' },
        ],
        new Date('2099-05-05T00:00:00Z'),
      ),
    ).toBe(2)
  })
})

describe('household gamification', () => {
  it('counts only completed duties assigned to the member and ignores unassigned dates', () => {
    expect(
      countRecentDutyCompletions(
        [
          { assigneeId: 'member', completedAt: '2099-05-01T10:00:00Z', cancelled: false },
          { assigneeId: 'other', completedAt: '2099-05-02T10:00:00Z', cancelled: false },
          { assigneeId: null, completedAt: '2099-05-03T10:00:00Z', cancelled: false },
          { assigneeId: 'member', completedAt: null, cancelled: false },
          { assigneeId: 'member', completedAt: '2099-05-05T10:00:00Z', cancelled: true },
        ],
        'member',
      ),
    ).toBe(1)
  })
})

describe('meal achievements', () => {
  it('awards feedback achievement only after meaningful member ratings', () => {
    expect(
      deriveMealAchievements('MEMBER', [
        { id: '1', name: 'A', mealDate: '2099-05-01', averageRating: 5, ratingCount: 2, ownRating: 5 },
        { id: '2', name: 'B', mealDate: '2099-04-30', averageRating: 4, ratingCount: 1, ownRating: 4 },
        { id: '3', name: 'C', mealDate: '2099-04-29', averageRating: 4, ratingCount: 1, ownRating: 4 },
      ]),
    ).toEqual([{ key: 'feedback', label: 'Người góp ý nhiệt tình' }])
    expect(deriveMealAchievements('MEMBER', [])).toEqual([])
  })

  it('awards family favorite only with enough strong ratings for Mom', () => {
    expect(
      deriveMealAchievements('PARENT', [
        { id: '1', name: 'A', mealDate: '2099-05-01', averageRating: 4.7, ratingCount: 3, ownRating: null },
      ]),
    ).toEqual([{ key: 'favorite', label: 'Món cả nhà yêu thích' }])
    expect(
      deriveMealAchievements('PARENT', [
        { id: '1', name: 'A', mealDate: '2099-05-01', averageRating: 5, ratingCount: 2, ownRating: null },
      ]),
    ).toEqual([])
  })
})
