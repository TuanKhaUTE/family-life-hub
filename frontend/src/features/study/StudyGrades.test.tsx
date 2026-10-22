import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { StudyPage } from './StudyPage'
import { StudyGrades } from './StudyGrades'
import type { Assessment, GradeView } from './grades-api'
const profile = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'MEMBER' as const,
  displayName: 'Thử nghiệm',
  avatarType: null,
  avatarValue: null,
}
const id = profile.id,
  other = '22222222-2222-4222-8222-222222222222'
it('offers intentional per-assessment sharing without sharing the Study workspace', async () => {
  network()
  render(<StudyGrades onClose={() => {}} />)
  await screen.findByRole('heading', { name: 'Bài tổng hợp' })
  expect(
    screen.getByRole('button', { name: 'Chia sẻ Bài tổng hợp' }),
  ).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Chia sẻ toàn bộ' })).toBeNull()
})
const assessment: Assessment = {
  id,
  courseId: id,
  title: 'Bài tổng hợp',
  assessmentType: 'MIDTERM',
  score: 8.7,
  maxScore: 10,
  letterGrade: 'B',
  weightPercent: 30,
  assessedAt: '2026-10-22',
  note: 'Ghi chú tổng hợp',
  percentage: 87,
  createdAt: '2026-10-22T00:00:00Z',
  updatedAt: '2026-10-22T00:00:00Z',
}
function view(): GradeView {
  return {
    courses: [
      { id, name: 'Môn tổng hợp' },
      { id: other, name: 'Môn khác' },
    ],
    assessments: [{ ...assessment }],
    summaries: [
      {
        courseId: id,
        courseName: 'Môn tổng hợp',
        assessmentCount: 1,
        numericCount: 1,
        averagePercent: 87,
        weightedCoveragePercent: 30,
        weightedEarnedPercent: 26.1,
        weightState: 'INCOMPLETE',
        latestAssessment: { ...assessment },
      },
    ],
  }
}
function network(data = view(), readError = false, writeError = false) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (!init?.method) {
        if (readError) throw new Error('private network detail')
        const cid = new URL(url, 'http://local').searchParams.get('courseId')
        return new Response(
          JSON.stringify({
            grades: {
              courses: cid
                ? data.courses.filter((c) => c.id === cid)
                : data.courses,
              assessments: cid
                ? data.assessments.filter((a) => a.courseId === cid)
                : data.assessments,
              summaries: cid
                ? data.summaries.filter((s) => s.courseId === cid)
                : data.summaries,
            },
          }),
        )
      }
      if (writeError)
        return new Response(
          JSON.stringify({
            error: { code: 'STUDY_INVALID', message: 'private storage detail' },
          }),
          { status: 400 },
        )
      if (init.method === 'DELETE') {
        data.assessments = []
        data.summaries = []
      } else {
        const input = JSON.parse(String(init.body))
        data.assessments = [
          {
            ...assessment,
            ...input,
            percentage: input.score === null ? null : 85,
          },
        ]
        data.summaries = [{ ...view().summaries[0]!, averagePercent: 85 }]
      }
      return new Response(null, { status: 204 })
    }),
  )
  return calls
}
function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
async function ready() {
  await waitFor(() => {
    expect(screen.queryByRole('form')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  await screen.findByRole('button', { name: 'Thêm điểm' })
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('opens a focused grades area from the otherwise calm Study page', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.startsWith('/api/study/assessments')
              ? { grades: view() }
              : {
                  study: {
                    semesters: [],
                    courses: [],
                    goals: [],
                    sessions: [],
                    summary: {
                      weekStart: '2026-10-19',
                      weekEnd: '2026-10-25',
                      totalMinutes: 0,
                      sessionCount: 0,
                      goals: [],
                      courses: [],
                    },
                  },
                },
          ),
        ),
    ),
  )
  render(<StudyPage profile={profile} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Xem điểm môn học' }))
  expect(
    await screen.findByRole('heading', { name: 'Điểm môn học' }),
  ).toBeTruthy()
  expect(
    await screen.findByText('Bài tổng hợp', { selector: 'h2' }),
  ).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Ghi buổi học' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Về Học tập' }))
  expect(
    await screen.findByRole('button', { name: 'Ghi buổi học' }),
  ).toBeTruthy()
})
it('shows percentage, letter, weight, date and honest incomplete coverage in Vietnamese', async () => {
  network()
  render(<StudyGrades onClose={() => {}} />)
  expect(await screen.findByText('8,7/10 · 87%')).toBeTruthy()
  expect(screen.getByText('Điểm chữ: B')).toBeTruthy()
  expect(screen.getByText('Trọng số: 30%')).toBeTruthy()
  expect(screen.getByText(/Chưa đủ trọng số/)).toBeTruthy()
  expect(screen.getByText('Trung bình điểm số: 87%')).toBeTruthy()
  expect(screen.getByText('22/10/2026')).toBeTruthy()
})
it('filters through the API while keeping the full course selector', async () => {
  const calls = network()
  render(<StudyGrades onClose={() => {}} />)
  await screen.findByText('8,7/10 · 87%')
  change('Lọc theo môn', other)
  expect(await screen.findByText('Chưa có điểm nào')).toBeTruthy()
  expect(screen.queryByText('8,7/10 · 87%')).toBeNull()
  expect(
    calls.some((c) => c.url === `/api/study/assessments?courseId=${other}`),
  ).toBe(true)
  expect(
    within(screen.getByLabelText('Lọc theo môn')).getAllByRole('option'),
  ).toHaveLength(3)
})
it('adds an assessment then collapses the form and refreshes the summary', async () => {
  const data = view()
  data.assessments = []
  data.summaries = []
  const calls = network(data)
  render(<StudyGrades onClose={() => {}} />)
  await screen.findByText('Chưa có điểm nào')
  fireEvent.click(screen.getByRole('button', { name: 'Thêm điểm' }))
  change('Tên bài', 'Bài mới tổng hợp')
  change('Loại', 'QUIZ')
  change('Điểm đạt được (không bắt buộc)', '34')
  change('Điểm tối đa (không bắt buộc)', '40')
  change('Điểm chữ (không bắt buộc)', 'A')
  change('Trọng số (%, không bắt buộc)', '30')
  fireEvent.submit(screen.getByRole('form'))
  await ready()
  expect(await screen.findByText('34/40 · 85%')).toBeTruthy()
  expect(screen.getByText('Trung bình điểm số: 85%')).toBeTruthy()
  expect(
    JSON.parse(
      String(calls.find((c) => c.init?.method === 'POST')!.init!.body),
    ),
  ).toMatchObject({
    title: 'Bài mới tổng hợp',
    score: 34,
    maxScore: 40,
    weightPercent: 30,
  })
  expect(screen.queryByRole('form')).toBeNull()
})
it('edits the existing assessment identity and deletes only after confirmation', async () => {
  const calls = network()
  render(<StudyGrades onClose={() => {}} />)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Chỉnh sửa Bài tổng hợp' }),
  )
  expect((screen.getByLabelText('Tên bài') as HTMLInputElement).value).toBe(
    'Bài tổng hợp',
  )
  change('Tên bài', 'Bài đã sửa')
  fireEvent.submit(screen.getByRole('form'))
  await ready()
  expect(
    await screen.findByRole('button', { name: 'Xóa Bài đã sửa' }),
  ).toBeTruthy()
  expect(
    calls.some(
      (c) =>
        c.url === `/api/study/assessments/${id}` && c.init?.method === 'PUT',
    ),
  ).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Xóa Bài đã sửa' }))
  expect(calls.some((c) => c.init?.method === 'DELETE')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Đồng ý xóa' }))
  expect(await screen.findByText('Chưa có điểm nào')).toBeTruthy()
  expect(
    calls.some(
      (c) =>
        c.url === `/api/study/assessments/${id}` && c.init?.method === 'DELETE',
    ),
  ).toBe(true)
})
it('supports letter-only grades without inventing a numeric average', async () => {
  const data = view()
  data.assessments = [
    {
      ...assessment,
      score: null,
      maxScore: null,
      percentage: null,
      weightPercent: null,
      letterGrade: 'A',
    },
  ]
  data.summaries = [
    {
      ...data.summaries[0]!,
      averagePercent: null,
      numericCount: 0,
      weightedCoveragePercent: 0,
      weightedEarnedPercent: null,
      weightState: 'NONE',
    },
  ]
  network(data)
  render(<StudyGrades onClose={() => {}} />)
  expect(await screen.findByText('Chưa có trung bình điểm số')).toBeTruthy()
  expect(screen.getByText('A', { selector: '.grade-score' })).toBeTruthy()
})
it('disables adding grades without a course and shows a real empty state', async () => {
  network({ courses: [], assessments: [], summaries: [] })
  render(<StudyGrades onClose={() => {}} />)
  expect(await screen.findByText('Chưa có điểm nào')).toBeTruthy()
  expect(
    (screen.getByRole('button', { name: 'Thêm điểm' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true)
  expect(screen.getByText(/Bạn thêm môn/)).toBeTruthy()
})
it('has safe loading, error and retry states', async () => {
  network(view(), true)
  render(<StudyGrades onClose={() => {}} />)
  expect(screen.getByRole('status').textContent).toContain('Đang mở điểm')
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByText('private network detail')).toBeNull()
  network()
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('8,7/10 · 87%')).toBeTruthy()
})
it('retains the draft on safe write errors', async () => {
  network(view(), false, true)
  render(<StudyGrades onClose={() => {}} />)
  await screen.findByText('8,7/10 · 87%')
  fireEvent.click(screen.getByRole('button', { name: 'Thêm điểm' }))
  change('Tên bài', 'Bài chưa lưu')
  fireEvent.submit(screen.getByRole('form'))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect((screen.getByLabelText('Tên bài') as HTMLInputElement).value).toBe(
    'Bài chưa lưu',
  )
  expect(screen.queryByText('private storage detail')).toBeNull()
})
it('PARENT never requests or displays grades', () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  render(<StudyPage profile={{ ...profile, role: 'PARENT' }} />)
  expect(fetch).not.toHaveBeenCalled()
  expect(screen.queryByText('Điểm môn học')).toBeNull()
})
