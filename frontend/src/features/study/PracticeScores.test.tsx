import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PracticeScores } from './PracticeScores'

const courseId = '11111111-1111-4111-8111-111111111111'
const disabledCourseId = '22222222-2222-4222-8222-222222222222'
const sessionId = '33333333-3333-4333-8333-333333333333'
const disabledSessionId = '44444444-4444-4444-8444-444444444444'
const result = { id: courseId, sessionId: courseId, courseId, courseName: 'Môn thử', studiedAt: '2026-10-22', metricTitle: 'Bài 1', score: 32, maxScore: 40, note: null, createdAt: '2026-10-22T00:00:00Z', updatedAt: '2026-10-22T00:00:00Z' }
const view = { courses: [{ id: courseId, name: 'Môn thử', practiceTracking: true }], results: [result], trends: [{ courseId, courseName: 'Môn thử', latest: result, previous: null, changePercentagePoints: null, thisWeekAverage: 80, previousWeekAverage: null, thisMonthAverage: 80, previousMonthAverage: null, history: [result] }] }
const sessions = [
  { id: sessionId, courseId, studiedAt: '2026-10-22' },
]
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
describe('practice score UI', () => {
  it('separates Vietnamese practice scores and keeps the compact result entry', async () => {
    const calls: RequestInit[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => { if (init) calls.push(init); return new Response(JSON.stringify({ practice: view }), { status: init?.method === 'POST' ? 204 : 200 }) }))
    render(<PracticeScores courseIds={[courseId]} sessions={sessions} />)
    expect(await screen.findByRole('heading', { name: 'Điểm luyện tập' })).toBeTruthy()
    expect(screen.getAllByText(/Bài 1/).length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText('Chỉ số / tên bài'), { target: { value: 'Bài 2' } })
    fireEvent.change(screen.getByLabelText('Điểm đạt được'), { target: { value: '17' } })
    fireEvent.change(screen.getByLabelText('Điểm tối đa'), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu điểm luyện tập' }))
    await waitFor(() => expect(calls.some((init) => init.method === 'POST')).toBe(true))
  })
  it('only offers completed sessions from practice-tracked courses', async () => {
    const trackedSession = { id: sessionId, courseId, studiedAt: '2026-10-22' }
    const disabledSession = { id: disabledSessionId, courseId: disabledCourseId, studiedAt: '2026-10-23' }
    const trackedView = {
      ...view,
      courses: [
        { id: courseId, name: 'Software Testing', practiceTracking: true },
        { id: disabledCourseId, name: 'IELTS', practiceTracking: false },
      ],
      trends: [],
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ practice: trackedView }))))
    render(
      <PracticeScores
        courseIds={[courseId, disabledCourseId]}
        sessions={[trackedSession, disabledSession]}
      />,
    )
    const select = await screen.findByLabelText('Buổi học')
    expect(screen.getByRole('option', { name: /Software Testing · 2026-10-22/ })).toBeTruthy()
    expect(within(select).queryByRole('option', { name: /IELTS/ })).toBeNull()
  })
  it('updates eligible sessions immediately when practice tracking is enabled', async () => {
    const trackedView = {
      ...view,
      courses: [
        { id: courseId, name: 'Software Testing', practiceTracking: true },
        { id: disabledCourseId, name: 'IELTS', practiceTracking: false },
      ],
      trends: [],
    }
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        trackedView.courses[1]!.practiceTracking = true
        return new Response(null, { status: 204 })
      }
      return new Response(JSON.stringify({ practice: trackedView }))
    })
    vi.stubGlobal('fetch', fetchMock)
    render(
      <PracticeScores
        courseIds={[courseId, disabledCourseId]}
        sessions={[
          { id: sessionId, courseId, studiedAt: '2026-10-22' },
          { id: disabledSessionId, courseId: disabledCourseId, studiedAt: '2026-10-23' },
        ]}
      />,
    )
    await screen.findByLabelText('Buổi học')
    await screen.findByRole('button', { name: 'Bật Theo dõi điểm luyện tập · IELTS' }).then((button) => fireEvent.click(button))
    await waitFor(() => expect(screen.getByRole('option', { name: /IELTS · 2026-10-23/ })).toBeTruthy())
  })
  it('hides score entry and shows a hint when no eligible session exists', async () => {
    const noSessionView = { ...view, courses: [{ id: courseId, name: 'Software Testing', practiceTracking: true }], trends: [] }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ practice: noSessionView }))))
    render(<PracticeScores courseIds={[courseId]} sessions={[]} />)
    expect(await screen.findByText('Chưa có buổi học đủ điều kiện để ghi điểm luyện tập.')).toBeTruthy()
    expect(screen.queryByLabelText('Chỉ số / tên bài')).toBeNull()
  })
  it('keeps long practice history collapsed until requested', async () => {
    const history = Array.from({ length: 5 }, (_, index) => ({
      ...result,
      id: `55555555-5555-4555-8555-${String(index + 1).padStart(12, '0')}`,
      metricTitle: `Bài ${index + 1}`,
      studiedAt: `2026-10-${String(index + 1).padStart(2, '0')}`,
    }))
    const historyView = {
      ...view,
      results: history,
      trends: [{ ...view.trends[0]!, latest: history[4]!, previous: history[3]!, history }],
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ practice: historyView }))))
    render(<PracticeScores courseIds={[courseId]} sessions={sessions} />)

    const trend = await screen.findByRole('heading', { name: 'Môn thử' })
    const trendArticle = trend.closest('article') as HTMLElement
    expect(within(trendArticle).getByText(/Bài 3/)).toBeTruthy()
    expect(within(trendArticle).getAllByText(/Bài 5/).length).toBeGreaterThan(0)
    expect(within(trendArticle).queryByText(/Bài 2/)).toBeNull()
    fireEvent.click(
      within(trendArticle).getByRole('button', { name: 'Xem thêm kết quả' }),
    )
    expect(within(trendArticle).getByText(/Bài 2/)).toBeTruthy()
    fireEvent.click(
      within(trendArticle).getByRole('button', { name: 'Thu gọn kết quả' }),
    )
    expect(within(trendArticle).queryByText(/Bài 2/)).toBeNull()
  })
})
