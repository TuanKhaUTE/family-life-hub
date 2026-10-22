import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { FitnessSection } from '../fitness/FitnessSection'
import { WellnessSection } from './WellnessSection'
import { StudyPage } from '../study/StudyPage'
import type { WellnessWorkspace } from './wellness-api'
import { familyDate } from '../meals/family-time'

const id = '11111111-1111-4111-8111-111111111111',
  today = familyDate()
function workspace(): WellnessWorkspace {
  return {
    profile: { heightCm: 174, targetWeightKg: 64, activityLevel: null },
    logs: [
      { id, loggedDate: today, weightKg: 62.5, note: 'Ghi chú tổng hợp' },
      {
        id: '22222222-2222-4222-8222-222222222222',
        loggedDate: '2026-01-01',
        weightKg: 62,
        note: null,
      },
    ],
    summary: {
      currentWeightKg: 62.5,
      currentLoggedDate: today,
      previousWeightKg: 62,
      previousLoggedDate: '2026-01-01',
      changeKg: 0.5,
      bmi: 20.6,
      trend7: null,
      trend30: null,
    },
  }
}
function network(data = workspace(), writeError = false, readError = false) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (!init?.method) {
        if (readError) throw new Error('private network details')
        return new Response(JSON.stringify({ wellness: data }))
      }
      if (writeError)
        return new Response(
          JSON.stringify({
            error: {
              code: 'WELLNESS_DATE_EXISTS',
              message: 'private SQL detail',
            },
          }),
          { status: 409 },
        )
      if (url.endsWith('/profile')) data.profile = JSON.parse(String(init.body))
      else if (init.method === 'DELETE')
        data.logs = data.logs.filter((log) => !url.endsWith(log.id))
      else {
        const input = JSON.parse(String(init.body))
        if (init.method === 'POST') data.logs.unshift({ id, ...input })
        else
          data.logs = data.logs.map((log) =>
            url.endsWith(log.id) ? { id: log.id, ...input } : log,
          )
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
  await waitFor(() => expect(screen.queryByRole('form')).toBeNull())
  await screen.findByRole('button', { name: 'Ghi cân nặng' })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('places a separate private Thể trạng subsection inside Rèn luyện', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url === '/api/wellness'
              ? {
                  wellness: {
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
                  },
                }
              : {
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
                },
          ),
        ),
    ),
  )
  render(<FitnessSection />)
  expect(await screen.findByRole('region', { name: 'Thể trạng' })).toBeTruthy()
  expect(
    await screen.findByRole('button', { name: 'Ghi cân nặng' }),
  ).toBeTruthy()
  expect(
    await screen.findByRole('button', { name: 'Ghi buổi tập' }),
  ).toBeTruthy()
})
it('updates only explicit optional profile values and collapses the form', async () => {
  const data = workspace(),
    calls = network(data)
  render(<WellnessSection />)
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Cập nhật thông tin' }))
  change('Chiều cao (cm, không bắt buộc)', '175')
  change('Cân nặng mục tiêu (kg, không bắt buộc)', '')
  change('Mức vận động (không bắt buộc)', 'LIGHT')
  fireEvent.submit(screen.getByRole('form'))
  await ready()
  expect(
    JSON.parse(String(calls.find((c) => c.init?.method === 'PUT')!.init!.body)),
  ).toEqual({ heightCm: 175, targetWeightKg: null, activityLevel: 'LIGHT' })
  expect(screen.getByText('Chưa đặt mục tiêu')).toBeTruthy()
})
it('logs a weight, refreshes the real summary, and preserves it after remount', async () => {
  const data = workspace()
  data.logs = []
  data.profile = null
  data.summary = {
    currentWeightKg: null,
    currentLoggedDate: null,
    previousWeightKg: null,
    previousLoggedDate: null,
    changeKg: null,
    bmi: null,
    trend7: null,
    trend30: null,
  }
  const calls = network(data),
    view = render(<WellnessSection />)
  await ready()
  expect(screen.getByText('Chưa có lần cân nào')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Ghi cân nặng' }))
  change('Cân nặng (kg)', '62.5')
  change('Ghi chú lần cân (không bắt buộc)', 'Ghi chú dùng thử')
  data.summary = {
    ...data.summary,
    currentWeightKg: 62.5,
    currentLoggedDate: today,
  }
  fireEvent.submit(screen.getByRole('form'))
  await ready()
  expect(screen.getByText('Ghi chú dùng thử')).toBeTruthy()
  expect(
    within(
      screen.getByRole('region', { name: 'Tổng quan thể trạng' }),
    ).getByText('62,5 kg'),
  ).toBeTruthy()
  expect(calls.find((c) => c.init?.method === 'POST')!.url).toBe(
    '/api/wellness/logs',
  )
  expect(JSON.stringify(calls)).not.toMatch(/ownerMemberId|owner_member_id/)
  view.unmount()
  render(<WellnessSection />)
  await ready()
  expect(screen.getByText('Ghi chú dùng thử')).toBeTruthy()
})
it('edits a saved measurement by identity and requires confirmation before deletion', async () => {
  const calls = network()
  render(<WellnessSection />)
  await ready()
  fireEvent.click(screen.getByRole('button', { name: `Sửa lần cân ${today}` }))
  change('Cân nặng (kg)', '63')
  fireEvent.submit(screen.getByRole('form'))
  await ready()
  expect(calls.find((c) => c.init?.method === 'PUT')!.url).toBe(
    `/api/wellness/logs/${id}`,
  )
  expect(screen.getByText('63 kg')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: `Xóa lần cân ${today}` }))
  expect(calls.some((c) => c.init?.method === 'DELETE')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Giữ lại' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: `Xóa lần cân ${today}` }))
  fireEvent.click(screen.getByRole('button', { name: 'Đồng ý xóa lần cân' }))
  await ready()
  expect(calls.find((c) => c.init?.method === 'DELETE')!.url).toBe(
    `/api/wellness/logs/${id}`,
  )
  expect(screen.queryByText('Ghi chú tổng hợp')).toBeNull()
})
it('shows target, signed change, BMI and actual observed trend spans without judgment', async () => {
  const data = workspace()
  data.summary.trend7 = {
    fromDate: '2026-10-16',
    toDate: '2026-10-22',
    changeKg: 0.5,
    pointCount: 2,
  }
  data.summary.trend30 = { ...data.summary.trend7, pointCount: 3 }
  network(data)
  render(<WellnessSection />)
  await ready()
  const summary = within(
    screen.getByRole('region', { name: 'Tổng quan thể trạng' }),
  )
  expect(summary.getByText('64 kg')).toBeTruthy()
  expect(summary.getByText('+0,5 kg')).toBeTruthy()
  expect(summary.getByText('20,6')).toBeTruthy()
  expect(screen.getByText(/2 lần cân/)).toBeTruthy()
  expect(screen.getByText(/3 lần cân/)).toBeTruthy()
  expect(screen.getByText(/không phải đánh giá sức khỏe/)).toBeTruthy()
  expect(screen.queryByText(/béo phì|thiếu cân|thừa cân/i)).toBeNull()
})
it('keeps the draft and guides duplicate-date conflicts to the existing entry', async () => {
  network(workspace(), true)
  render(<WellnessSection />)
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Ghi cân nặng' }))
  change('Cân nặng (kg)', '62.5')
  fireEvent.submit(screen.getByRole('form'))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toContain('sửa lần cân đã có')
  expect(
    (screen.getByLabelText('Cân nặng (kg)') as HTMLInputElement).value,
  ).toBe('62.5')
  expect(screen.queryByText('private SQL detail')).toBeNull()
})
it('offers safe loading, independent retry and incomplete BMI/trend states', async () => {
  network(workspace(), false, true)
  render(<WellnessSection />)
  expect(screen.getByRole('status', { name: 'Tải thể trạng' })).toBeTruthy()
  expect(await screen.findByRole('alert')).toBeTruthy()
  const data = workspace()
  data.profile = null
  data.logs = []
  data.summary = {
    currentWeightKg: null,
    currentLoggedDate: null,
    previousWeightKg: null,
    previousLoggedDate: null,
    changeKg: null,
    bmi: null,
    trend7: null,
    trend30: null,
  }
  network(data)
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại thể trạng' }))
  await ready()
  expect(screen.getByText('Chưa có lần cân nào')).toBeTruthy()
  expect(screen.getByText(/Thêm chiều cao và lần cân/)).toBeTruthy()
  expect(
    screen.getAllByText('Cần ít nhất hai lần cân trong khoảng này.'),
  ).toHaveLength(2)
  expect(screen.queryByText('private network details')).toBeNull()
})
it('PARENT neither renders nor requests a Wellness workspace', () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  render(
    <StudyPage
      profile={{
        id,
        role: 'PARENT',
        displayName: 'Synthetic',
        avatarType: null,
        avatarValue: null,
      }}
    />,
  )
  expect(screen.queryByRole('region', { name: 'Thể trạng' })).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
})
it('keeps history compact with only recorded observations and explicit expansion', async () => {
  const data = workspace()
  data.logs = Array.from({ length: 14 }, (_, i) => ({
    id: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`,
    loggedDate: `2026-01-${String(31 - i).padStart(2, '0')}`,
    weightKg: 62,
    note: null,
  }))
  network(data)
  render(<WellnessSection />)
  await ready()
  const history = within(
    screen.getByRole('region', { name: 'Lịch sử cân nặng' }),
  )
  expect(history.getAllByRole('listitem')).toHaveLength(7)
  fireEvent.click(history.getByRole('button', { name: 'Xem thêm lần cân' }))
  expect(history.getAllByRole('listitem')).toHaveLength(14)
  fireEvent.click(history.getByRole('button', { name: 'Thu gọn lần cân' }))
  expect(history.getAllByRole('listitem')).toHaveLength(7)
})
it.each(['ADMIN', 'MEMBER'] as const)(
  '%s sees only the returned personal workspace without member switching',
  async (role) => {
    const data = workspace()
    const fetch = vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url === '/api/wellness'
              ? { wellness: data }
              : url === '/api/study'
                ? {
                    study: {
                      semesters: [],
                      courses: [],
                      goals: [],
                      sessions: [],
                      summary: {
                        weekStart: today,
                        weekEnd: today,
                        totalMinutes: 0,
                        sessionCount: 0,
                        goals: [],
                        courses: [],
                      },
                    },
                  }
                : {
                    fitness: {
                      plans: [],
                      days: [],
                      goals: [],
                      sessions: [],
                      summary: {
                        weekStart: today,
                        weekEnd: today,
                        sessionsThisWeek: 0,
                        weeklyTarget: null,
                        completionPercent: null,
                        totalMinutes: 0,
                        unrecordedDurationCount: 0,
                        nextWorkout: null,
                      },
                    },
                  },
          ),
        ),
    )
    vi.stubGlobal('fetch', fetch)
    render(
      <StudyPage
        profile={{
          id,
          role,
          displayName: 'Synthetic',
          avatarType: null,
          avatarValue: null,
        }}
      />,
    )
    const section = await screen.findByRole('region', { name: 'Thể trạng' })
    expect(await within(section).findByText('Ghi chú tổng hợp')).toBeTruthy()
    expect(within(section).queryByRole('combobox')).toBeNull()
    expect(
      fetch.mock.calls
        .filter((call) => call[0].startsWith('/api/wellness'))
        .map((call) => call[0]),
    ).toEqual(['/api/wellness'])
  },
)
