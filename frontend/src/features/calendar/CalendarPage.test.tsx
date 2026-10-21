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
    expect(screen.getByRole('status').textContent).toContain('Đang xem lịch')
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
