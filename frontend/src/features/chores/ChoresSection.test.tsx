import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChoresSection } from './ChoresSection'
import type { FamilyProfile } from '../auth/auth-api'
import { familyDate } from '../meals/family-time'
import type { ChoreItem } from './chore-api'
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
  displayName: 'Người nhà thử nghiệm',
  avatarType: 'EMOJI',
  avatarValue: '🌱',
}
const date = familyDate()
const schedule = {
  id,
  requestId: id,
  title: 'Rửa bát thử nghiệm',
  category: 'DISHES' as const,
  scheduledDate: date,
  scheduledTime: null,
  assignedMemberId: id,
  weeklyAssignments: [],
  recurrenceUntil: null,
  note: null,
  createdByMemberId: otherId,
  cancelled: false,
  createdAt: `${date}T00:00:00Z`,
  updatedAt: `${date}T00:00:00Z`,
}
function chore(owner = profile): ChoreItem {
  return {
    schedule: {
      ...schedule,
      id: owner.id,
      requestId: owner.id,
      assignedMemberId: owner.id,
    },
    date,
    assignee: owner,
    status: 'PENDING',
    completedAt: null,
    completedByMemberId: null,
  }
}
function network(
  items = [chore(), chore({ ...profile, ...other })],
  fail = false,
  writeError = false,
) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (fail) throw new Error('private network detail')
      if (init?.method) {
        if (writeError)
          return new Response(
            JSON.stringify({
              error: {
                code: 'CHORE_CONFLICT',
                message: 'private storage detail',
              },
            }),
            { status: 409 },
          )
        if (url.endsWith('/complete'))
          items[0] = {
            ...items[0]!,
            status: 'COMPLETED',
            completedAt: `${date}T12:00:00Z`,
            completedByMemberId: id,
          }
        if (url.endsWith('/cancel'))
          items[0] = { ...items[0]!, status: 'CANCELLED' }
        return (init.method === 'POST' && url.endsWith('/schedules')) ||
          init.method === 'PUT'
          ? new Response(JSON.stringify({ scheduleId: id }), { status: 201 })
          : new Response(null, { status: 204 })
      }
      return new Response(
        JSON.stringify({
          chores: {
            from: date,
            to: date,
            timeZone: 'Asia/Ho_Chi_Minh',
            members: [profile, other],
            chores: items,
          },
        }),
      )
    }),
  )
  return calls
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe('family chores UI', () => {
  it.each(['ADMIN', 'MEMBER'] as const)(
    '%s sees own chores first and only self-completion',
    async (role) => {
      network()
      render(
        <ChoresSection
          profile={{ ...profile, role }}
          from={date}
          to={date}
          memberId={null}
        />,
      )
      const region = screen.getByRole('region', { name: 'Việc nhà hôm nay' })
      expect(await within(region).findAllByText(/Sau bữa tối/)).toHaveLength(2)
      const cards = within(region).getAllByRole('article')
      expect(within(cards[0]!).getByText(profile.displayName)).toBeTruthy()
      expect(
        within(cards[0]!).getByRole('button', { name: 'Đã làm xong' }),
      ).toBeTruthy()
      expect(within(cards[1]!).queryByRole('button')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Thêm việc' })).toBeNull()
    },
  )
  it('completes own chore into compact checked state without repeat action', async () => {
    const calls = network([chore()])
    render(
      <ChoresSection profile={profile} from={date} to={date} memberId={null} />,
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Đã làm xong' }),
    )
    expect(await screen.findByText('Hoàn thành ✓')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Đã làm xong' })).toBeNull()
    expect(calls.filter((c) => c.url.endsWith('/complete'))).toHaveLength(1)
    expect(calls.find((c) => c.url.endsWith('/complete'))!.url).toBe(
      `/api/chores/schedules/${id}/occurrences/${date}/complete`,
    )
  })
  it('parent adds a chore with active assignee and closes the form', async () => {
    const calls = network()
    render(
      <ChoresSection
        profile={{ ...profile, role: 'PARENT' }}
        from={date}
        to={date}
        memberId={null}
      />,
    )
    await screen.findByText('Quản lý việc nhà')
    await userEvent.click(screen.getByRole('button', { name: 'Thêm việc' }))
    fireEvent.change(screen.getByLabelText('Tên việc'), {
      target: { value: 'Việc nhà mới' },
    })
    await userEvent.selectOptions(screen.getByLabelText('Giao cho'), otherId)
    await userEvent.click(screen.getByRole('button', { name: 'Lưu việc' }))
    expect(await screen.findByText('Đã lưu lịch việc nhà.')).toBeTruthy()
    expect(
      screen.queryByRole('form', { name: 'Thông tin việc nhà' }),
    ).toBeNull()
    const body = JSON.parse(
      String(calls.find((c) => c.init?.method === 'POST')!.init!.body),
    )
    expect(body).toMatchObject({
      title: 'Việc nhà mới',
      assignedMemberId: otherId,
      weeklyAssignments: [],
    })
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(body).not.toHaveProperty('actorMemberId')
  })
  it('parent configures weekly weekday assignments without RRULE syntax', async () => {
    const calls = network()
    render(
      <ChoresSection
        profile={{ ...profile, role: 'PARENT' }}
        from={date}
        to={date}
        memberId={null}
      />,
    )
    await screen.findByText('Quản lý việc nhà')
    await userEvent.click(
      screen.getByRole('button', { name: 'Lịch lặp hàng tuần' }),
    )
    await userEvent.selectOptions(screen.getByLabelText('Thứ Hai'), otherId)
    await userEvent.selectOptions(screen.getByLabelText('Thứ Ba'), id)
    await userEvent.click(screen.getByRole('button', { name: 'Lưu việc' }))
    await screen.findByText('Đã lưu lịch việc nhà.')
    expect(
      JSON.parse(
        String(calls.find((c) => c.init?.method === 'POST')!.init!.body),
      ),
    ).toMatchObject({
      category: 'DISHES',
      title: 'Rửa bát',
      assignedMemberId: null,
      weeklyAssignments: [
        { weekday: 1, memberId: otherId },
        { weekday: 2, memberId: id },
      ],
    })
  })
  it('parent edits/reassigns an existing chore rather than duplicating it', async () => {
    const calls = network([chore()])
    render(
      <ChoresSection
        profile={{ ...profile, role: 'PARENT' }}
        from={date}
        to={date}
        memberId={null}
      />,
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Chỉnh sửa / giao lại' }),
    )
    fireEvent.change(screen.getByLabelText('Tên việc'), {
      target: { value: 'Việc đã đổi' },
    })
    await userEvent.selectOptions(screen.getByLabelText('Giao cho'), otherId)
    await userEvent.click(screen.getByRole('button', { name: 'Lưu việc' }))
    await screen.findByText('Đã lưu lịch việc nhà.')
    expect(calls.find((c) => c.init?.method === 'PUT')!.url).toBe(
      `/api/chores/schedules/${id}`,
    )
    expect(
      JSON.parse(
        String(calls.find((c) => c.init?.method === 'PUT')!.init!.body),
      ),
    ).toMatchObject({ assignedMemberId: otherId, requestId: id })
  })
  it('parent cancels only this occurrence, leaving a recurring pattern available', async () => {
    const calls = network([chore()])
    render(
      <ChoresSection
        profile={{ ...profile, role: 'PARENT' }}
        from={date}
        to={date}
        memberId={null}
      />,
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Hủy lần này' }),
    )
    expect(await screen.findByText('Đã hủy lần này.')).toBeTruthy()
    expect(calls.find((c) => c.url.endsWith('/cancel'))!.url).toContain(
      `/occurrences/${date}/cancel`,
    )
  })
  it('has warm loading/empty/error/retry states', async () => {
    network([], true)
    render(
      <ChoresSection profile={profile} from={date} to={date} memberId={null} />,
    )
    expect(screen.getByRole('status').textContent).toContain(
      'Đang xem việc nhà',
    )
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText('private network detail')).toBeNull()
    network([])
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(
      await screen.findByText('Hôm nay chưa có việc nhà cần làm.'),
    ).toBeTruthy()
  })
  it('keeps failed completion retryable and does not expose storage details', async () => {
    network([chore()], false, true)
    render(
      <ChoresSection profile={profile} from={date} to={date} memberId={null} />,
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Đã làm xong' }),
    )
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText('private storage detail')).toBeNull()
    expect(
      (screen.getByRole('button', { name: 'Đã làm xong' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)
  })
})
