import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CalendarPage } from './CalendarPage'
import { familyDate } from '../meals/family-time'
import type { FamilyProfile } from '../auth/auth-api'
vi.mock('../chores/chore-api', () => ({
  fetchChores: async () => ({ members: [], chores: [] }),
}))
vi.mock('../chores/household-duty-api', () => ({
  fetchHouseholdDuties: async () => ({ members: [], duties: [] }),
}))

const id = '11111111-1111-4111-8111-111111111111',
  otherId = '22222222-2222-4222-8222-222222222222'
const profile: FamilyProfile = {
  id,
  displayName: 'Bạn thử nghiệm',
  role: 'MEMBER',
  avatarType: null,
  avatarValue: null,
}
const other = {
  id: otherId,
  displayName: 'Thành viên khác',
  avatarType: 'EMOJI',
  avatarValue: '🌱',
}
const today = familyDate()
const series = {
  id,
  ownerMemberId: id,
  title: 'Lịch thử nghiệm',
  category: 'SCHOOL',
  startsAt: `${today}T02:30:00Z`,
  endsAt: `${today}T07:00:00Z`,
  note: 'Ghi chú thử nghiệm',
  weekdays: null as number[] | null,
  recurrenceUntil: null,
  createdAt: `${today}T00:00:00Z`,
  updatedAt: `${today}T00:00:00Z`,
}
function item(owner = profile, weekly = false) {
  return {
    event: {
      ...series,
      ownerMemberId: owner.id,
      weekdays: weekly ? [1, 2, 3, 4, 5] : null,
    },
    owner,
    date: today,
    title: series.title,
    startsAt: series.startsAt,
    endsAt: series.endsAt,
    note: series.note,
    cancelled: false,
    isException: false,
  }
}
function network(
  occurrences = [item()],
  fail = false,
  writeError: string | null = null,
) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (fail) throw new Error('private connection detail')
      if (init?.method && writeError)
        return new Response(
          JSON.stringify({
            error: { code: writeError, message: 'private storage detail' },
          }),
          { status: 409 },
        )
      if (!init?.method)
        return new Response(
          JSON.stringify({
            calendar: {
              from: today,
              to: today,
              timeZone: 'Asia/Ho_Chi_Minh',
              members: [profile, other],
              occurrences,
            },
          }),
        )
      if (url.endsWith('/duplicate-week'))
        return new Response(JSON.stringify({ copied: 1 }))
      if (init.method === 'DELETE' || url.includes('/occurrences/'))
        return new Response(null, { status: 204 })
      return new Response(JSON.stringify({ eventId: id }), {
        status: init.method === 'POST' ? 201 : 200,
      })
    }),
  )
  return calls
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe('shared family calendar', () => {
  it('allows an empty source date without crashing or submitting a copy', async () => {
    const calls = network()
    render(<CalendarPage profile={profile} />)
    await userEvent.click(
      screen.getByRole('button', { name: 'Nhân bản tuần' }),
    )
    fireEvent.change(screen.getByLabelText('Chọn ngày trong tuần nguồn'), {
      target: { value: '' },
    })
    expect(screen.getByRole('form', { name: 'Nhân bản lịch nhà' })).toBeTruthy()
    expect(
      (
        screen.getByRole('button', {
          name: 'Xác nhận nhân bản lịch',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)
    expect(calls.some((c) => c.url.endsWith('/duplicate-week'))).toBe(false)
    fireEvent.change(screen.getByLabelText('Chọn ngày trong tuần nguồn'), {
      target: { value: today },
    })
    expect(
      (
        screen.getByRole('button', {
          name: 'Xác nhận nhân bản lịch',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false)
  })
  it('confirms an owned family-week copy and reuses the retry-safe endpoint', async () => {
    const calls = network()
    render(<CalendarPage profile={profile} />)
    await screen.findByRole('button', { name: /Lịch thử nghiệm/ })
    await userEvent.click(
      screen.getByRole('button', { name: 'Nhân bản tuần' }),
    )
    expect(calls.some((c) => c.url.endsWith('/duplicate-week'))).toBe(false)
    expect(screen.getByText(/Chỉ sao chép lịch nhà của bạn/)).toBeTruthy()
    await userEvent.click(
      screen.getByRole('button', { name: 'Xác nhận nhân bản lịch' }),
    )
    await screen.findByText(
      'Đã thêm 1 lịch vào tuần sau. Lịch đã có không bị nhân đôi.',
    )
    const copy = calls.find((c) => c.url.endsWith('/duplicate-week'))!
    const body = JSON.parse(String(copy.init?.body))
    expect(Object.keys(body)).toEqual(['sourceWeek'])
    expect(new Date(body.sourceWeek + 'T12:00Z').getUTCDay()).toBe(1)
  })
  it('keeps family colors stable when filtering and uses a seven-column week grid', async () => {
    network([item({ ...profile, ...other })])
    render(<CalendarPage profile={profile} />)
    const before = await screen.findByRole('button', {
      name: /Lịch thử nghiệm/,
    })
    expect(before.classList.contains('calendar-tone-1')).toBe(true)
    await userEvent.click(
      screen.getByRole('button', { name: other.displayName }),
    )
    expect(
      (
        await screen.findByRole('button', { name: /Lịch thử nghiệm/ })
      ).classList.contains('calendar-tone-1'),
    ).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Tuần này' }))
    await screen.findByRole('region', { name: 'Lịch tuần' })
    expect(document.querySelectorAll('.calendar-grid-day')).toHaveLength(7)
  })
  it.each(['ADMIN', 'MEMBER'] as const)(
    '%s has separate personal owner calendar',
    async (role) => {
      const calls = network()
      render(<CalendarPage profile={{ ...profile, role }} />)
      await screen.findByRole('button', { name: /Lịch thử nghiệm/ })
      await userEvent.click(
        screen.getByRole('button', { name: 'Lịch của tôi' }),
      )
      await screen.findByRole('button', { name: /Lịch thử nghiệm/ })
      expect(calls.at(-1)!.url).toContain('calendarType=PERSONAL')
      expect(calls.at(-1)!.url).toContain(`memberId=${id}`)
      expect(screen.queryByRole('button', { name: 'Mọi người' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Nhân bản tuần' })).toBeNull()
    },
  )
  it('parent has family calendar only, with a positioned time axis', async () => {
    network()
    render(<CalendarPage profile={{ ...profile, role: 'PARENT' }} />)
    const event = await screen.findByRole('button', { name: /Lịch thử nghiệm/ })
    expect(
      screen.queryByRole('button', { name: 'Lịch của tôi' }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Lịch nhà' }),
    ).toBeTruthy()
    expect((event as HTMLElement).style.top).not.toBe('')
    expect(screen.getByLabelText('Trục giờ')).toBeTruthy()
  })
  it('keeps the form retryable and explains existing-exception conflicts safely', async () => {
    network([item()], false, 'CALENDAR_EXCEPTIONS_EXIST')
    render(<CalendarPage profile={profile} />)
    await userEvent.click(screen.getByRole('button', { name: 'Thêm lịch' }))
    fireEvent.change(screen.getByLabelText('Tiêu đề'), {
      target: { value: 'Lịch thử nghiệm mới' },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Lưu lịch' }))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Lịch này đã có thay đổi riêng. Hãy chỉnh từng lần để giữ nguyên các buổi đã đổi nhé.',
    )
    expect(screen.getByRole('form', { name: 'Thông tin lịch' })).toBeTruthy()
    expect(screen.queryByText('private storage detail')).toBeNull()
    expect(
      (screen.getByRole('button', { name: 'Lưu lịch' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)
  })
  it('shows Today timeline, Vietnamese times and family identity', async () => {
    network()
    render(<CalendarPage profile={profile} />)
    expect(
      await screen.findByRole('button', { name: /Lịch thử nghiệm/ }),
    ).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Lịch' })).toBeTruthy()
    expect(screen.getByText('Cùng nhau sắp xếp thời gian')).toBeTruthy()
    expect(screen.getByText('09:30').parentElement!.textContent).toBe(
      '09:30–14:00',
    )
    expect(
      screen
        .getByRole('button', { name: 'Hôm nay' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })
  it('uses a compact empty state instead of a blank day timeline', async () => {
    network([])
    render(<CalendarPage profile={profile} />)
    expect(
      await screen.findByText('Ngày này đang để trống'),
    ).toBeTruthy()
    expect(document.querySelector('.calendar-grid-scroll')).toBeNull()
    expect(screen.getByRole('button', { name: 'Thêm lịch' })).toBeTruthy()
  })
  it('reselecting Today refreshes instead of remaining stuck loading', async () => {
    network()
    render(<CalendarPage profile={profile} />)
    await screen.findByRole('button', { name: /Lịch thử nghiệm/ })
    await userEvent.click(screen.getByRole('button', { name: 'Hôm nay' }))
    expect(
      await screen.findByRole('button', { name: /Lịch thử nghiệm/ }),
    ).toBeTruthy()
  })
  it('requests the current week and filters by active member', async () => {
    const calls = network()
    render(<CalendarPage profile={profile} />)
    await screen.findByText('Cùng nhau sắp xếp thời gian')
    await userEvent.click(screen.getByRole('button', { name: 'Tuần này' }))
    await screen.findByRole('button', { name: /Lịch thử nghiệm/ })
    expect(calls.at(-1)!.url).toMatch(
      /from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/,
    )
    const latest = new URL(calls.at(-1)!.url, 'http://localhost')
    expect(
      Date.parse(latest.searchParams.get('to')!) -
        Date.parse(latest.searchParams.get('from')!),
    ).toBe(6 * 86400000)
    await userEvent.click(
      screen.getByRole('button', { name: other.displayName }),
    )
    await screen.findByRole('button', { name: /Lịch thử nghiệm/ })
    expect(calls.at(-1)!.url).toContain(`memberId=${otherId}`)
  })
  it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
    '%s sees another owner read-only',
    async (role) => {
      network([item({ ...profile, ...other })])
      render(<CalendarPage profile={{ ...profile, role }} />)
      await userEvent.click(
        await screen.findByRole('button', { name: /Lịch thử nghiệm/ }),
      )
      const details = screen.getByRole('region', { name: 'Chi tiết lịch' })
      expect(within(details).getByText(other.displayName)).toBeTruthy()
      expect(
        within(details).getByText('Lịch của thành viên khác · Chỉ xem'),
      ).toBeTruthy()
      expect(
        within(details).queryByRole('button', {
          name: /Chỉnh sửa|Xóa|Hủy lần/,
        }),
      ).toBeNull()
    },
  )
  it('creates own one-time event, closes the form and refreshes', async () => {
    const calls = network()
    render(<CalendarPage profile={profile} />)
    await screen.findByRole('button', { name: /Lịch thử nghiệm/ })
    await userEvent.click(screen.getByRole('button', { name: 'Thêm lịch' }))
    fireEvent.change(screen.getByLabelText('Tiêu đề'), {
      target: { value: 'Hoạt động mới' },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Lưu lịch' }))
    expect(await screen.findByText('Đã lưu lịch của bạn.')).toBeTruthy()
    expect(screen.queryByRole('form', { name: 'Thông tin lịch' })).toBeNull()
    const post = calls.find((c) => c.init?.method === 'POST')!
    expect(JSON.parse(String(post.init!.body))).toMatchObject({
      title: 'Hoạt động mới',
      weekdays: null,
      recurrenceUntil: null,
    })
    expect(String(post.init!.body)).not.toMatch(/ownerMemberId|actor/)
  })
  it('supports weekday selection and optional recurrence end', async () => {
    const calls = network()
    render(<CalendarPage profile={profile} />)
    await userEvent.click(screen.getByRole('button', { name: 'Thêm lịch' }))
    fireEvent.change(screen.getByLabelText('Tiêu đề'), {
      target: { value: 'Lịch hàng tuần' },
    })
    await userEvent.selectOptions(screen.getByLabelText('Lặp lại'), 'WEEKLY')
    for (const checkbox of screen.getAllByRole('checkbox'))
      if ((checkbox as HTMLInputElement).checked)
        await userEvent.click(checkbox)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Thứ Hai' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Thứ Tư' }))
    fireEvent.change(screen.getByLabelText('Lặp đến ngày (không bắt buộc)'), {
      target: { value: '2199-12-31' },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Lưu lịch' }))
    await screen.findByText('Đã lưu lịch của bạn.')
    expect(
      JSON.parse(
        String(calls.find((c) => c.init?.method === 'POST')!.init!.body),
      ),
    ).toMatchObject({ weekdays: [1, 3], recurrenceUntil: '2199-12-31' })
  })
  it('edits own event using the same form', async () => {
    const calls = network()
    render(<CalendarPage profile={profile} />)
    await userEvent.click(
      await screen.findByRole('button', { name: /Lịch thử nghiệm/ }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa' }))
    expect((screen.getByLabelText('Tiêu đề') as HTMLInputElement).value).toBe(
      'Lịch thử nghiệm',
    )
    fireEvent.change(screen.getByLabelText('Tiêu đề'), {
      target: { value: 'Lịch đã đổi' },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Lưu lịch' }))
    await screen.findByText('Đã lưu lịch của bạn.')
    expect(calls.find((c) => c.init?.method === 'PUT')!.url).toBe(
      `/api/calendar/events/${id}`,
    )
  })
  it('confirms own event deletion and reloads without writing another owner id', async () => {
    const calls = network()
    render(<CalendarPage profile={profile} />)
    await userEvent.click(
      await screen.findByRole('button', { name: /Lịch thử nghiệm/ }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Xóa lịch' }))
    await userEvent.click(screen.getByRole('button', { name: 'Đồng ý xóa' }))
    expect(await screen.findByText('Đã xóa lịch của bạn.')).toBeTruthy()
    expect(calls.find((c) => c.init?.method === 'DELETE')!.url).toBe(
      `/api/calendar/events/${id}`,
    )
  })
  it('changes just one weekly occurrence', async () => {
    const calls = network([item(profile, true)])
    render(<CalendarPage profile={profile} />)
    await userEvent.click(
      await screen.findByRole('button', { name: /Lịch thử nghiệm/ }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Chỉnh sửa lần này' }),
    )
    expect(screen.queryByLabelText('Lặp lại')).toBeNull()
    fireEvent.change(screen.getByLabelText('Tiêu đề'), {
      target: { value: 'Buổi học đã đổi' },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Lưu lịch' }))
    await screen.findByText('Đã lưu lịch của bạn.')
    const put = calls.find((c) => c.init?.method === 'PUT')!
    expect(put.url).toBe(`/api/calendar/events/${id}/occurrences/${today}`)
    expect(JSON.parse(String(put.init!.body))).toMatchObject({
      cancelled: false,
      title: 'Buổi học đã đổi',
    })
    expect(
      calls.filter(
        (c) =>
          c.url === `/api/calendar/events/${id}` && c.init?.method === 'PUT',
      ),
    ).toHaveLength(0)
  })
  it('cancels a single occurrence without deleting the series', async () => {
    const calls = network([item(profile, true)])
    render(<CalendarPage profile={profile} />)
    await userEvent.click(
      await screen.findByRole('button', { name: /Lịch thử nghiệm/ }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Hủy lần này' }))
    await screen.findByText('Đã hủy lần này. Các tuần khác vẫn giữ nguyên.')
    const put = calls.find((c) => c.init?.method === 'PUT')!
    expect(put.url).toContain(`/occurrences/${today}`)
    expect(JSON.parse(String(put.init!.body))).toEqual({ cancelled: true })
    expect(calls.some((c) => c.init?.method === 'DELETE')).toBe(false)
  })
  it('shows cancelled items distinctly', async () => {
    const cancelled = {
      ...item(profile, true),
      cancelled: true,
      isException: true,
    }
    network([cancelled])
    render(<CalendarPage profile={profile} />)
    expect(await screen.findByText('Đã hủy lần này')).toBeTruthy()
  })
  it('has warm loading, empty and safe retry states', async () => {
    network([], true)
    render(<CalendarPage profile={profile} />)
    expect(
      screen.getByRole('status', { name: 'Tải lịch' }).textContent,
    ).toContain('Đang xem lịch')
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText('private connection detail')).toBeNull()
    network([])
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(
      await screen.findByText(
        'Khoảng thời gian này chưa có lịch. Cả nhà có thể thong thả một chút nhé.',
      ),
    ).toBeTruthy()
  })
})
