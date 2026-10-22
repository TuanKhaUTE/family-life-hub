import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HouseholdDutySection } from './HouseholdDutySection'
import { familyDate } from '../meals/family-time'
import { weekRange, shiftDay } from '../calendar/calendar-time'
import type { FamilyProfile } from '../auth/auth-api'
const profile: FamilyProfile = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Bạn thử nghiệm',
  role: 'MEMBER',
  avatarType: null,
  avatarValue: null,
}
const other = {
  ...profile,
  id: '22222222-2222-4222-8222-222222222222',
  displayName: 'Người khác',
}
const today = familyDate()
const duty = {
  id: '33333333-3333-4333-8333-333333333333',
  date: today,
  assignee: profile,
  cancelled: false,
  completedAt: null as string | null,
  completedByMemberId: null as string | null,
}
function network(duties = [duty], fail = false) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (fail) throw new Error('private connection')
      if (!init?.method)
        return new Response(
          JSON.stringify({ household: { members: [profile, other], duties } }),
        )
      if (url.endsWith('/duplicate-week'))
        return new Response(JSON.stringify({ copied: 1 }))
      if (url.endsWith('/complete'))
        duties = duties.map((d) => ({
          ...d,
          completedAt: new Date().toISOString(),
          completedByMemberId: profile.id,
        }))
      return new Response(null, { status: 204 })
    }),
  )
  return calls
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe('combined duty calendar', () => {
  it('assignee completes today and sees compact confirmation without repeat control', async () => {
    const calls = network()
    render(<HouseholdDutySection profile={profile} from={today} to={today} />)
    expect(await screen.findByText('Rửa chén & Đổ rác')).toBeTruthy()
    expect(screen.getByText('Hôm nay tới phiên bạn')).toBeTruthy()
    await userEvent.click(
      screen.getByRole('button', { name: 'Hoàn thành việc nhà ✓' }),
    )
    expect(await screen.findByText('Đã hoàn thành ✓')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Hoàn thành việc nhà ✓' }),
    ).toBeNull()
    expect(calls.filter((c) => c.init?.method === 'POST')).toHaveLength(1)
    expect(
      calls.find((c) => c.init?.method === 'POST')!.init?.body,
    ).toBeUndefined()
  })
  it.each(['ADMIN', 'MEMBER'] as const)(
    '%s cannot manage or complete another assignee duty',
    async (role) => {
      network([{ ...duty, assignee: other }])
      render(
        <HouseholdDutySection
          profile={{ ...profile, role }}
          from={today}
          to={today}
        />,
      )
      await screen.findByText('Rửa chén & Đổ rác')
      expect(
        screen.queryByRole('button', { name: 'Quản lý việc nhà' }),
      ).toBeNull()
      expect(
        screen.queryByRole('button', { name: 'Hoàn thành việc nhà ✓' }),
      ).toBeNull()
    },
  )
  it('does not allow completion of past or future dates', async () => {
    network([
      { ...duty, date: shiftDay(today, -1) },
      { ...duty, id: other.id, date: shiftDay(today, 1) },
    ])
    render(
      <HouseholdDutySection
        profile={profile}
        from={shiftDay(today, -1)}
        to={shiftDay(today, 1)}
      />,
    )
    await screen.findAllByText('Rửa chén & Đổ rác')
    expect(
      screen.queryByRole('button', { name: 'Hoàn thành việc nhà ✓' }),
    ).toBeNull()
  })
  it('parent edits a weekly assignment and explicitly confirms copying the week', async () => {
    const calls = network([])
    render(
      <HouseholdDutySection
        profile={{ ...profile, role: 'PARENT' }}
        from={weekRange(today).from}
        to={weekRange(today).to}
      />,
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Quản lý việc nhà' }),
    )
    const selects = screen.getAllByRole('combobox')
    await userEvent.selectOptions(selects[0], other.id)
    await userEvent.click(screen.getByRole('button', { name: 'Lưu tuần' }))
    expect(await screen.findByText('Đã lưu lịch việc nhà.')).toBeTruthy()
    const save = calls.find((c) => c.init?.method === 'PUT')!
    expect(JSON.parse(String(save.init?.body))).toEqual({
      assignments: [{ date: weekRange(today).from, memberId: other.id }],
    })
    await userEvent.click(
      await screen.findByRole('button', { name: 'Quản lý việc nhà' }),
    )
    await screen.findAllByRole('combobox')
    await userEvent.click(
      screen.getByRole('button', { name: 'Nhân bản tuần việc nhà' }),
    )
    expect(calls.some((c) => c.url.endsWith('/duplicate-week'))).toBe(false)
    await userEvent.click(
      screen.getByRole('button', { name: 'Xác nhận nhân bản việc nhà' }),
    )
    await waitFor(() =>
      expect(calls.some((c) => c.url.endsWith('/duplicate-week'))).toBe(true),
    )
  })
  it('keeps failures safe and retryable', async () => {
    network([], true)
    render(<HouseholdDutySection profile={profile} from={today} to={today} />)
    expect(screen.getByText('Đang xem lịch việc nhà…')).toBeTruthy()
    expect(await screen.findByRole('alert')).toBeTruthy()
    network([])
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại việc nhà' }))
    expect(
      await screen.findByText('Chưa phân công việc nhà trong khoảng này.'),
    ).toBeTruthy()
    expect(screen.queryByText(/private connection/)).toBeNull()
  })
})
