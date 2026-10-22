import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PracticeScores } from './PracticeScores'

const courseId = '11111111-1111-4111-8111-111111111111'
const result = { id: courseId, sessionId: courseId, courseId, courseName: 'Môn thử', studiedAt: '2026-10-22', metricTitle: 'Bài 1', score: 32, maxScore: 40, note: null, createdAt: '2026-10-22T00:00:00Z', updatedAt: '2026-10-22T00:00:00Z' }
const view = { courses: [{ id: courseId, name: 'Môn thử', practiceTracking: true }], results: [result], trends: [{ courseId, courseName: 'Môn thử', latest: result, previous: null, changePercentagePoints: null, thisWeekAverage: 80, previousWeekAverage: null, thisMonthAverage: 80, previousMonthAverage: null, history: [result] }] }
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
describe('practice score UI', () => {
  it('separates Vietnamese practice scores and keeps the compact result entry', async () => {
    const calls: RequestInit[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => { if (init) calls.push(init); return new Response(JSON.stringify({ practice: view }), { status: init?.method === 'POST' ? 204 : 200 }) }))
    render(<PracticeScores courseIds={[courseId]} sessionIds={[courseId]} />)
    expect(await screen.findByRole('heading', { name: 'Điểm luyện tập' })).toBeTruthy()
    expect(screen.getAllByText(/Bài 1/).length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText('Chỉ số / tên bài'), { target: { value: 'Bài 2' } })
    fireEvent.change(screen.getByLabelText('Điểm đạt được'), { target: { value: '17' } })
    fireEvent.change(screen.getByLabelText('Điểm tối đa'), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu điểm luyện tập' }))
    await waitFor(() => expect(calls.some((init) => init.method === 'POST')).toBe(true))
  })
})
