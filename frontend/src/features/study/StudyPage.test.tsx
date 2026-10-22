import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthenticatedShell } from '../auth/AuthenticatedShell'
import { StudyPage } from './StudyPage'
import type { StudyWorkspace, StudyKind } from './study-api'
import { familyDate } from '../meals/family-time'
vi.mock('../wellness/wellness-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../wellness/wellness-api')>()),
  fetchWellness: async () => ({
    profile: null,
    logs: [],
    summary: {
      currentWeightKg: null,
      currentLoggedDate: null,
      previousWeightKg: null,
      previousLoggedDate: null,
      changeKg: null,
      bmi: null,
      trend7: null,
      trend30: null,
    },
  }),
}))
vi.mock('../fitness/fitness-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../fitness/fitness-api')>()
  return {
    ...actual,
    fetchFitness: async () => ({
      plans: [],
      days: [],
      goals: [],
      sessions: [],
      summary: {
        weekStart: '2026-10-19',
        weekEnd: '2026-10-25',
        sessionsThisWeek: 0,
        weeklyTarget: null,
        completionPercent: null,
        totalMinutes: 0,
        unrecordedDurationCount: 0,
        nextWorkout: null,
      },
    }),
  }
})
const id = '11111111-1111-4111-8111-111111111111'
const today = familyDate(),
  profile = {
    id,
    role: 'MEMBER' as const,
    displayName: 'Thử nghiệm',
    avatarType: null,
    avatarValue: null,
  }
function workspace(): StudyWorkspace {
  return {
    semesters: [
      {
        id,
        name: 'Học kỳ thử',
        startDate: '2026-01-01',
        endDate: '2027-12-31',
        isActive: true,
      },
    ],
    courses: [{ id, semesterId: id, name: 'Môn thử', code: null }],
    goals: [
      {
        id,
        courseId: id,
        title: 'Mục tiêu thử',
        targetMinutes: 300,
        targetDate: null,
        status: 'ACTIVE',
      },
    ],
    sessions: [
      {
        id,
        courseId: id,
        studiedAt: today,
        durationMinutes: 90,
        note: 'Ghi chú thử',
      },
    ],
    summary: {
      weekStart: today,
      weekEnd: today,
      totalMinutes: 90,
      sessionCount: 1,
      goals: [
        {
          id,
          title: 'Mục tiêu thử',
          targetMinutes: 300,
          targetDate: null,
          minutes: 90,
        },
      ],
      courses: [{ courseId: id, name: 'Môn thử', minutes: 90 }],
    },
  }
}
function network(data = workspace(), failRead = false, failWrite = false) {
  let next = 1
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (!init?.method) {
        if (failRead) throw new Error('private network detail')
        return new Response(JSON.stringify({ study: data }))
      }
      if (failWrite)
        return new Response(
          JSON.stringify({
            error: { code: 'STUDY_IN_USE', message: 'private storage detail' },
          }),
          { status: 409 },
        )
      const parts = url.split('/'),
        kind = parts[3] as StudyKind,
        rowId = parts[4],
        list = data[kind] as unknown as { id: string }[]
      if (init.method === 'DELETE') {
        const index = list.findIndex((x) => x.id === rowId)
        list.splice(index, 1)
      } else {
        const input = JSON.parse(String(init.body)),
          row = {
            id:
              rowId ??
              `22222222-2222-4222-8222-${String(next++).padStart(12, '0')}`,
            ...input,
          }
        if (rowId) list[list.findIndex((x) => x.id === rowId)] = row
        else list.unshift(row)
        if (kind === 'sessions') {
          data.summary.totalMinutes = 90
          data.summary.sessionCount = 1
          data.summary.courses = [
            { courseId: null, name: 'Tự học', minutes: 90 },
          ]
        }
      }
      data.summary.goals = data.goals
        .filter((g) => g.status === 'ACTIVE')
        .map((g) => ({
          id: g.id,
          title: g.title,
          targetMinutes: g.targetMinutes,
          targetDate: g.targetDate,
          minutes: 90,
        }))
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
  await screen.findByRole('button', { name: 'Ghi buổi học' })
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe('private Study destination', () => {
  it.each(['ADMIN', 'MEMBER'] as const)(
    '%s has functional Study and Fitness destinations',
    async (role) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({
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
              }),
            ),
        ),
      )
      render(
        <AuthenticatedShell
          profile={{
            id,
            role,
            displayName: 'Thử nghiệm',
            avatarType: null,
            avatarValue: null,
          }}
          isLoggingOut={false}
          error={null}
          onLogout={() => {}}
        />,
      )
      fireEvent.click(
        within(screen.getByRole('navigation')).getByRole('button', {
          name: 'Học & Luyện',
        }),
      )
      expect(
        await screen.findByRole('button', { name: 'Ghi buổi học' }),
      ).toBeTruthy()
      expect(
        await screen.findByText('Chưa có buổi học nào trong tuần này'),
      ).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'Rèn luyện' })).toBeTruthy()
      expect(
        await screen.findByRole('button', { name: 'Ghi buổi tập' }),
      ).toBeTruthy()
      expect(screen.queryByText('Sắp có')).toBeNull()
    },
  )
  it('creates a semester and course, logs a session, then creates and completes a goal', async () => {
    const empty = workspace()
    empty.semesters = []
    empty.courses = []
    empty.goals = []
    empty.sessions = []
    empty.summary = {
      ...empty.summary,
      totalMinutes: 0,
      sessionCount: 0,
      goals: [],
      courses: [],
    }
    const calls = network(empty)
    render(<StudyPage profile={profile} />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Quản lý môn học' }))
    fireEvent.click(screen.getByRole('button', { name: 'Thêm học kỳ' }))
    change('Tên học kỳ', 'Học kỳ tổng hợp')
    change('Ngày bắt đầu', '2026-01-01')
    change('Ngày kết thúc', '2027-12-31')
    fireEvent.submit(screen.getByRole('form', { name: 'Học kỳ' }))
    await ready()
    expect(screen.queryByRole('form')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Thêm môn học' }))
    change('Tên môn', 'Môn tổng hợp')
    fireEvent.submit(screen.getByRole('form', { name: 'Môn học' }))
    await ready()
    expect(screen.getAllByText('Môn tổng hợp').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Ghi buổi học' }))
    change('Thời lượng (phút)', '90')
    change('Ghi chú (không bắt buộc)', 'Nội dung tổng hợp')
    fireEvent.submit(screen.getByRole('form', { name: 'Buổi học' }))
    await ready()
    expect(screen.getByText('Nội dung tổng hợp')).toBeTruthy()
    expect(
      within(
        screen.getByRole('region', { name: 'Thời gian học tuần này' }),
      ).getByText('1 giờ 30 phút'),
    ).toBeTruthy()
    expect(screen.queryByRole('form')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Thêm mục tiêu' }))
    change('Tên mục tiêu', 'Mục tiêu tổng hợp')
    change('Mục tiêu thời gian tuần này (phút, không bắt buộc)', '300')
    fireEvent.submit(screen.getByRole('form', { name: 'Mục tiêu học tập' }))
    await ready()
    expect(
      screen
        .getByRole('progressbar', { name: 'Tiến độ Mục tiêu tổng hợp' })
        .getAttribute('value'),
    ).toBe('90')
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu hoàn thành' }))
    expect(await screen.findByText('Hoàn thành ✓')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Đánh dấu hoàn thành' }),
    ).toBeNull()
    const writes = calls.filter((c) => c.init?.method)
    expect(writes).toHaveLength(5)
    expect(JSON.parse(String(writes[2]!.init!.body)).courseId).toBeNull()
    expect(JSON.stringify(writes)).not.toMatch(/ownerMemberId|actorMemberId/)
  })
  it.each(['semesters', 'courses', 'goals', 'sessions'] as const)(
    'edits and explicitly confirms deletion of own %s',
    async (kind) => {
      const calls = network()
      render(<StudyPage profile={profile} />)
      await ready()
      if (kind === 'semesters' || kind === 'courses')
        fireEvent.click(screen.getByRole('button', { name: 'Quản lý môn học' }))
      const label =
        kind === 'semesters'
          ? 'Học kỳ thử'
          : kind === 'courses'
            ? 'Môn thử'
            : kind === 'goals'
              ? 'Mục tiêu thử'
              : null
      fireEvent.click(
        screen.getByRole('button', {
          name: label ? `Sửa ${label}` : /^Sửa Buổi học/,
        }),
      )
      if (kind === 'sessions') change('Thời lượng (phút)', '60')
      else
        change(
          kind === 'semesters'
            ? 'Tên học kỳ'
            : kind === 'courses'
              ? 'Tên môn'
              : 'Tên mục tiêu',
          'Đã chỉnh sửa',
        )
      fireEvent.submit(screen.getByRole('form'))
      await ready()
      expect(
        calls.some(
          (c) =>
            c.url === `/api/study/${kind}/${id}` && c.init?.method === 'PUT',
        ),
      ).toBe(true)
      fireEvent.click(
        screen.getByRole('button', {
          name: kind === 'sessions' ? /^Xóa Buổi học/ : 'Xóa Đã chỉnh sửa',
        }),
      )
      expect(calls.some((c) => c.init?.method === 'DELETE')).toBe(false)
      fireEvent.click(screen.getByRole('button', { name: 'Đồng ý xóa' }))
      await ready()
      expect(
        calls.some(
          (c) =>
            c.url === `/api/study/${kind}/${id}` && c.init?.method === 'DELETE',
        ),
      ).toBe(true)
      expect(screen.queryByRole('dialog')).toBeNull()
    },
  )
  it('PARENT never requests or renders a private Study workspace', () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    render(<StudyPage profile={{ ...profile, role: 'PARENT' }} />)
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryByRole('button')).toBeNull()
  })
  it('offers loading, safe network error, and retry', async () => {
    network(workspace(), true)
    render(<StudyPage profile={profile} />)
    expect(
      within(screen.getByRole('region', { name: 'Học tập' })).getByRole(
        'status',
      ).textContent,
    ).toContain('Đang mở')
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText('private network detail')).toBeNull()
    network()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await ready()
    expect(screen.getByText('Ghi chú thử')).toBeTruthy()
  })
  it('retains an unsaved form on write failure with an actionable Vietnamese error', async () => {
    network(workspace(), false, true)
    render(<StudyPage profile={profile} />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Thêm mục tiêu' }))
    change('Tên mục tiêu', 'Chưa lưu')
    fireEvent.submit(screen.getByRole('form'))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(
      (screen.getByLabelText('Tên mục tiêu') as HTMLInputElement).value,
    ).toBe('Chưa lưu')
    expect(screen.queryByText('private storage detail')).toBeNull()
  })
})
