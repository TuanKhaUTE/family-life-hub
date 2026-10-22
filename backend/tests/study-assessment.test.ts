import { describe, expect, it } from 'vitest'
import {
  normalizeAssessment,
  assessmentPercentage,
  summarizeGrades,
  type Assessment,
} from '../src/services/study-assessment.js'
const id = '11111111-1111-4111-8111-111111111111'
const input = {
  courseId: id,
  title: ' Synthetic ',
  assessmentType: 'MIDTERM',
  score: 8.7,
  maxScore: 10,
  weightPercent: 30,
  letterGrade: null,
  assessedAt: null,
  note: null,
}
function row(overrides: Partial<Assessment> = {}): Assessment {
  return {
    id,
    ...normalizeAssessment(input),
    createdAt: '2026-10-22T00:00:00Z',
    updatedAt: '2026-10-22T00:00:00Z',
    ...overrides,
  }
}
describe('assessment validation and honest grade calculations', () => {
  it('normalizes optional text and calculates percentages without storing redundant values', () => {
    expect(
      normalizeAssessment({ ...input, letterGrade: ' A ', note: ' ' }),
    ).toMatchObject({ title: 'Synthetic', letterGrade: 'A', note: null })
    expect(assessmentPercentage(input)).toBe(87)
    expect(assessmentPercentage({ score: 34, maxScore: 40 })).toBe(85)
    expect(assessmentPercentage({ score: null, maxScore: 100 })).toBeNull()
  })
  it.each([
    { score: -1 },
    { score: 11 },
    { maxScore: 0 },
    { maxScore: null },
    { score: Infinity },
    { score: NaN },
    { score: '8.7' },
    { weightPercent: -1 },
    { weightPercent: 101 },
    { weightPercent: NaN },
    { title: ' ' },
    { title: 'x'.repeat(161) },
    { letterGrade: 'x'.repeat(21) },
    { note: 'x'.repeat(1001) },
    { assessmentType: 'GPA' },
    { courseId: 'bad' },
    { assessedAt: '2026-02-30' },
    { ownerMemberId: id },
    { percentage: 87 },
    { score: 0.12345 },
  ])('rejects invalid/injected assessment input', (bad) =>
    expect(() => normalizeAssessment({ ...input, ...bad })).toThrow(),
  )
  it('accepts zero scores/weights, letter-only and pending assessments', () => {
    expect(
      normalizeAssessment({ ...input, score: 0, weightPercent: 0 }),
    ).toMatchObject({ score: 0, weightPercent: 0 })
    expect(
      normalizeAssessment({
        ...input,
        score: null,
        maxScore: null,
        letterGrade: 'B',
      }).score,
    ).toBeNull()
    expect(
      normalizeAssessment({ ...input, score: null, maxScore: 100 }),
    ).toMatchObject({ score: null, maxScore: 100 })
  })
  it('uses the mean of numeric percentages, not pooled points or missing scores', () => {
    const [s] = summarizeGrades({
      courses: [{ id, name: 'Synthetic' }],
      assessments: [
        row(),
        row({ score: 34, maxScore: 40, weightPercent: null }),
        row({ score: null, maxScore: null, letterGrade: 'A' }),
      ],
    })
    expect(s).toMatchObject({
      assessmentCount: 3,
      numericCount: 2,
      averagePercent: 86,
      weightedCoveragePercent: 30,
      weightedEarnedPercent: 26.1,
      weightState: 'INCOMPLETE',
    })
  })
  it('reports completed weighted coverage, excluding unscored weighted work', () => {
    const [s] = summarizeGrades({
      courses: [{ id, name: 'Synthetic' }],
      assessments: [
        row(),
        row({ score: 9, maxScore: 10, weightPercent: 70 }),
        row({ score: null, maxScore: 100, weightPercent: 20 }),
      ],
    })
    expect(s).toMatchObject({
      weightedCoveragePercent: 100,
      weightedEarnedPercent: 89.1,
      weightState: 'COMPLETE',
    })
  })
  it('does not invent a final result for oversubscribed weights', () => {
    const [s] = summarizeGrades({
      courses: [{ id, name: 'Synthetic' }],
      assessments: [row({ weightPercent: 60 }), row({ weightPercent: 60 })],
    })
    expect(s).toMatchObject({
      weightedCoveragePercent: 120,
      weightedEarnedPercent: null,
      weightState: 'OVERALLOCATED',
    })
  })
  it('does not round incomplete or excessive coverage into an apparent 100 percent', () => {
    const [s] = summarizeGrades({
      courses: [{ id, name: 'Synthetic' }],
      assessments: [
        row({ weightPercent: 33.3333 }),
        row({ weightPercent: 33.3333 }),
        row({ weightPercent: 33.3333 }),
      ],
    })
    expect(s).toMatchObject({
      weightedCoveragePercent: 99.9999,
      weightState: 'INCOMPLETE',
    })
  })
  it('returns null averages for empty or letter-only data', () => {
    const [s] = summarizeGrades({
      courses: [{ id, name: 'Synthetic' }],
      assessments: [row({ score: null, maxScore: null, letterGrade: 'A' })],
    })
    expect(s).toMatchObject({
      averagePercent: null,
      weightedCoveragePercent: 0,
      weightedEarnedPercent: null,
      weightState: 'NONE',
    })
  })
  it('selects latest dated work deterministically and keeps summaries course-scoped', () => {
    const latest = row({ id: 'latest', assessedAt: '2026-10-22' }),
      older = row({ id: 'older', assessedAt: '2026-10-21' })
    const [s, empty] = summarizeGrades({
      courses: [
        { id, name: 'Synthetic' },
        { id: 'other', name: 'Empty' },
      ],
      assessments: [row(), latest, older],
    })
    expect(s!.latestAssessment!.id).toBe('latest')
    expect(empty).toMatchObject({
      assessmentCount: 0,
      averagePercent: null,
      latestAssessment: null,
    })
  })
})
