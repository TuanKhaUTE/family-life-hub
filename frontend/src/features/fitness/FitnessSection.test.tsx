import {
  cleanup,
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { StudyPage } from '../study/StudyPage'
import { FitnessSection } from './FitnessSection'
import type { FitnessWorkspace, FitnessKind } from './fitness-api'
import { familyDate } from '../meals/family-time'
import { emptyActivityView } from '../activities/activity-fixtures.test-utils'
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
const id = '11111111-1111-4111-8111-111111111111',
  today = familyDate()
function workspace(): FitnessWorkspace {
  return {
    plans: [{ id, name: 'Kế hoạch thử', note: null, isActive: true }],
    days: [
      { id, planId: id, weekday: 1, title: 'Buổi theo lịch thử', note: null },
    ],
    goals: [{ id, weeklySessionTarget: 3, isActive: true }],
    sessions: [
      {
        id,
        planDayId: id,
        performedAt: today,
        durationMinutes: 60,
        title: 'Buổi đã tập thử',
        note: 'Ghi chú rèn luyện thử',
      },
    ],
    summary: {
      weekStart: today,
      weekEnd: today,
      sessionsThisWeek: 1,
      weeklyTarget: 3,
      completionPercent: 33,
      totalMinutes: 60,
      unrecordedDurationCount: 0,
      nextWorkout: {
        planDayId: id,
        title: 'Buổi theo lịch thử',
        date: today,
        weekday: 1,
      },
    },
  }
}
function network(data = workspace(), readError = false, writeError = false) {
  let n = 1
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (url.startsWith('/api/personal-activities')) return new Response(JSON.stringify({ activities: emptyActivityView() }))
      if (!init?.method) {
        if (readError) throw new Error('private network detail')
        return new Response(JSON.stringify({ fitness: data }))
      }
      if (writeError)
        return new Response(
          JSON.stringify({
            error: {
              code: 'FITNESS_DAY_EXISTS',
              message: 'private SQL detail',
            },
          }),
          { status: 409 },
        )
      const parts = url.split('/'),
        kind = parts[3] as FitnessKind,
        rowId = parts[4],
        list = data[kind] as unknown as { id: string }[]
      if (init.method === 'DELETE') {
        list.splice(
          list.findIndex((x) => x.id === rowId),
          1,
        )
      } else {
        const input = JSON.parse(String(init.body)),
          row = {
            id:
              rowId ??
              `22222222-2222-4222-8222-${String(n++).padStart(12, '0')}`,
            ...input,
          }
        if (rowId) list[list.findIndex((x) => x.id === rowId)] = row
        else list.unshift(row)
      }
      data.summary = {
        ...data.summary,
        sessionsThisWeek: 1,
        weeklyTarget:
          data.goals.find((g) => g.isActive)?.weeklySessionTarget ?? null,
        completionPercent: data.goals.some((g) => g.isActive) ? 33 : null,
        totalMinutes: 60,
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
  await screen.findByRole('button', { name: 'Ghi buổi tập' })
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('replaces the Fitness placeholder while keeping Study functional', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url === '/api/fitness'
              ? {
                  fitness: {
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
                  },
                }
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
  render(
    <StudyPage
      profile={{
        id: '11111111-1111-4111-8111-111111111111',
        role: 'MEMBER',
        displayName: 'Thử nghiệm',
        avatarType: null,
        avatarValue: null,
      }}
    />,
  )
  expect(
    await screen.findByRole('button', { name: 'Ghi buổi tập' }),
  ).toBeTruthy()
  expect(
    await screen.findByRole('button', { name: 'Ghi buổi học' }),
  ).toBeTruthy()
  expect(screen.queryByText('Sắp có')).toBeNull()
})
it('creates a plan, configures weekday workouts, sets a goal and logs a free workout', async () => {
  const data = workspace()
  data.plans = []
  data.days = []
  data.goals = []
  data.sessions = []
  data.summary = {
    ...data.summary,
    sessionsThisWeek: 0,
    weeklyTarget: null,
    completionPercent: null,
    totalMinutes: 0,
    nextWorkout: null,
  }
  const calls = network(data)
  render(<FitnessSection />)
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Lịch tập' }))
  fireEvent.click(screen.getByRole('button', { name: 'Thêm kế hoạch' }))
  change('Tên kế hoạch', 'Kế hoạch tổng hợp')
  fireEvent.submit(screen.getByRole('form'))
  await ready()
  expect(screen.getByText('Kế hoạch tổng hợp')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Thêm ngày tập' }))
  change('Tên buổi tập', 'Buổi tổng hợp')
  change('Ngày trong tuần', '3')
  fireEvent.submit(screen.getByRole('form'))
  await ready()
  expect(screen.getByText('Buổi tổng hợp')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Mục tiêu tuần' }))
  change('Số buổi mỗi tuần', '3')
  fireEvent.submit(screen.getByRole('form'))
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Ghi buổi tập' }))
  change('Tên buổi tập', 'Buổi tập tự do thử')
  change('Thời lượng tập (phút, không bắt buộc)', '60')
  change('Ghi chú tập luyện (không bắt buộc)', 'Ghi chú mới')
  fireEvent.submit(screen.getByRole('form'))
  await ready()
  expect(screen.getByText('Ghi chú mới')).toBeTruthy()
  const summary = screen.getByRole('region', { name: 'Rèn luyện trong tuần' })
  expect(within(summary).getByText('1 / 3 buổi hoàn thành')).toBeTruthy()
  expect(within(summary).getByText('1 giờ')).toBeTruthy()
  expect(within(summary).getByRole('progressbar').getAttribute('value')).toBe(
    '1',
  )
  expect(screen.queryByRole('form')).toBeNull()
  const writes = calls.filter((c) => c.init?.method === 'POST')
  expect(writes).toHaveLength(4)
  expect(JSON.parse(String(writes[1]!.init!.body))).toMatchObject({
    weekday: 3,
    title: 'Buổi tổng hợp',
  })
  expect(JSON.parse(String(writes[3]!.init!.body))).toMatchObject({
    planDayId: null,
    durationMinutes: 60,
  })
  expect(JSON.stringify(writes)).not.toMatch(/ownerMemberId|actorMemberId/)
})
it.each(['plans', 'days', 'sessions'] as const)(
  'edits and confirms deletion of own %s',
  async (kind) => {
    const calls = network()
    render(<FitnessSection />)
    await ready()
    if (kind !== 'sessions')
      fireEvent.click(screen.getByRole('button', { name: 'Lịch tập' }))
    const name =
      kind === 'plans'
        ? 'Kế hoạch thử'
        : kind === 'days'
          ? 'Buổi theo lịch thử'
          : 'Buổi đã tập thử'
    fireEvent.click(screen.getByRole('button', { name: `Sửa ${name}` }))
    change(kind === 'plans' ? 'Tên kế hoạch' : 'Tên buổi tập', 'Đã sửa thử')
    fireEvent.submit(screen.getByRole('form'))
    await ready()
    expect(
      await screen.findByRole('button', { name: 'Xóa Đã sửa thử' }),
    ).toBeTruthy()
    expect(
      calls.some(
        (c) =>
          c.url === `/api/fitness/${kind}/${id}` && c.init?.method === 'PUT',
      ),
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Xóa Đã sửa thử' }))
    expect(calls.some((c) => c.init?.method === 'DELETE')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Đồng ý xóa' }))
    await ready()
    expect(
      calls.some(
        (c) =>
          c.url === `/api/fitness/${kind}/${id}` && c.init?.method === 'DELETE',
      ),
    ).toBe(true)
  },
)
it('activates an existing inactive plan without creating another plan', async () => {
  const data = workspace()
  data.plans[0]!.isActive = false
  const calls = network(data)
  render(<FitnessSection />)
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Lịch tập' }))
  fireEvent.click(screen.getByRole('button', { name: 'Dùng kế hoạch này' }))
  await ready()
  expect(calls.filter((call) => call.init?.method === 'POST')).toHaveLength(0)
  const update = calls.find((call) => call.init?.method === 'PUT')!
  expect(update.url).toBe(`/api/fitness/plans/${id}`)
  expect(JSON.parse(String(update.init!.body))).toMatchObject({
    name: 'Kế hoạch thử',
    isActive: true,
  })
  expect(data.plans).toHaveLength(1)
  expect(screen.getByText('Đang dùng')).toBeTruthy()
})
it('updates an existing goal rather than creating a duplicate and can remove it explicitly', async () => {
  const calls = network()
  render(<FitnessSection />)
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Mục tiêu tuần' }))
  change('Số buổi mỗi tuần', '4')
  fireEvent.submit(screen.getByRole('form'))
  await ready()
  expect(calls.find((c) => c.init?.method === 'PUT')!.url).toBe(
    `/api/fitness/goals/${id}`,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ mục tiêu tuần' }))
  fireEvent.click(screen.getByRole('button', { name: 'Đồng ý xóa' }))
  await ready()
  expect(await screen.findByText('Bạn chưa đặt mục tiêu tuần.')).toBeTruthy()
})
it('logs a planned workout while preserving the title as a snapshot', async () => {
  const calls = network()
  render(<FitnessSection />)
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Ghi buổi tập' }))
  change('Buổi theo kế hoạch (không bắt buộc)', id)
  expect(
    (screen.getByLabelText('Tên buổi tập') as HTMLInputElement).value,
  ).toBe('Buổi theo lịch thử')
  fireEvent.submit(screen.getByRole('form'))
  await ready()
  expect(
    JSON.parse(
      String(calls.find((c) => c.init?.method === 'POST')!.init!.body),
    ),
  ).toMatchObject({
    planDayId: id,
    title: 'Buổi theo lịch thử',
    durationMinutes: null,
  })
})
it('shows a calm completed target and does not pretend unknown durations are zero', async () => {
  const data = workspace()
  data.summary = {
    ...data.summary,
    sessionsThisWeek: 3,
    weeklyTarget: 3,
    completionPercent: 100,
    totalMinutes: 0,
    unrecordedDurationCount: 3,
  }
  network(data)
  render(<FitnessSection />)
  await ready()
  expect(screen.getByText(/Bạn đã đạt mục tiêu tuần này/)).toBeTruthy()
  expect(screen.getByText('3 buổi chưa ghi thời lượng')).toBeTruthy()
  expect(
    within(
      screen.getByRole('region', { name: 'Rèn luyện trong tuần' }),
    ).getByText('Chưa ghi thời lượng'),
  ).toBeTruthy()
})
it('has safe loading, empty and retry states', async () => {
  network(workspace(), true)
  render(<FitnessSection />)
  expect(screen.getByRole('status', { name: 'Tải rèn luyện' })).toBeTruthy()
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByText('private network detail')).toBeNull()
  const data = workspace()
  data.sessions = []
  data.summary = { ...data.summary, sessionsThisWeek: 0, totalMinutes: 0 }
  network(data)
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại rèn luyện' }))
  expect(
    await screen.findByText('Chưa có buổi tập nào trong tuần này'),
  ).toBeTruthy()
})
it('keeps a failed draft with actionable weekday-conflict feedback', async () => {
  network(workspace(), false, true)
  render(<FitnessSection />)
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Lịch tập' }))
  fireEvent.click(screen.getByRole('button', { name: 'Thêm ngày tập' }))
  change('Tên buổi tập', 'Buổi chưa lưu')
  fireEvent.submit(screen.getByRole('form'))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toContain(
    'chỉnh sửa buổi đang có',
  )
  expect(
    (screen.getByLabelText('Tên buổi tập') as HTMLInputElement).value,
  ).toBe('Buổi chưa lưu')
  expect(screen.queryByText('private SQL detail')).toBeNull()
})
it('PARENT never requests a Fitness or Study workspace', () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  render(
    <StudyPage
      profile={{
        id,
        role: 'PARENT',
        displayName: 'Thử nghiệm',
        avatarType: null,
        avatarValue: null,
      }}
    />,
  )
  expect(fetch).not.toHaveBeenCalled()
  expect(screen.queryByRole('region', { name: 'Rèn luyện' })).toBeNull()
})
