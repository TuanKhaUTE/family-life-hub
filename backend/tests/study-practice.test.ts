import { describe, expect, it } from 'vitest'
import {
  normalizePracticeResult,
  practicePercentage,
  summarizePractice,
  type PracticeResult,
} from '../src/services/study-practice.js'

const id = '11111111-1111-4111-8111-111111111111'
const base = {
  sessionId: id,
  metricTitle: 'Listening',
  score: 32,
  maxScore: 40,
  note: null,
}
function result(overrides: Partial<PracticeResult> = {}): PracticeResult {
  return {
    id,
    ...base,
    courseId: id,
    courseName: 'IELTS Listening',
    studiedAt: '2026-10-22',
    createdAt: '2026-10-22T10:00:00Z',
    updatedAt: '2026-10-22T10:00:00Z',
    ...overrides,
  }
}

describe('practice-score validation and trends', () => {
  it('normalizes user metrics without adding IELTS-specific rules', () => {
    expect(normalizePracticeResult({ ...base, metricTitle: ' Listening ' })).toEqual({
      ...base,
      metricTitle: 'Listening',
    })
    expect(practicePercentage({ score: 17, maxScore: 20 })).toBe(85)
  })

  it.each([
    { sessionId: 'bad' },
    { metricTitle: ' ' },
    { score: -1 },
    { score: 41 },
    { maxScore: 0 },
    { score: 1.23456 },
    { ownerMemberId: id },
  ])('rejects invalid or injected result input', (bad) => {
    expect(() => normalizePracticeResult({ ...base, ...bad })).toThrow()
  })

  it('keeps raw scores and calculates normalized chronological trends', () => {
    const data = summarizePractice(
      [
        result({ id: 'latest', studiedAt: '2026-10-22', score: 17, maxScore: 20 }),
        result({ id: 'previous', studiedAt: '2026-10-21', score: 32, maxScore: 40 }),
        result({ id: 'older', studiedAt: '2026-10-14', score: 15, maxScore: 20 }),
      ],
      '2026-10-22',
    )
    expect(data[0]).toMatchObject({
      latest: { id: 'latest', score: 17, maxScore: 20 },
      previous: { id: 'previous' },
      changePercentagePoints: 5,
      thisWeekAverage: 82.5,
      previousWeekAverage: 75,
      thisMonthAverage: 80,
      previousMonthAverage: null,
    })
    expect(data[0]!.history.map((v) => v.id)).toEqual(['older', 'previous', 'latest'])
  })
})
