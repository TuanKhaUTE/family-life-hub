import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CalendarPage } from '../calendar/CalendarPage'
import { NotificationPanel } from '../notifications/NotificationPanel'
import { familyDate } from '../meals/family-time'
import type { FamilyProfile } from '../auth/auth-api'
const id = '11111111-1111-4111-8111-111111111111',
  date = familyDate()
const profile: FamilyProfile = {
  id,
  displayName: 'Thử nghiệm',
  role: 'PARENT',
  avatarType: null,
  avatarValue: null,
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('Lịch keeps chores separate and the existing notification panel refreshes after a schedule save', async () => {
  let saved = false,
    readAt: string | null = null
  const notice = {
    id,
    type: 'CHORE_ASSIGNMENT',
    title: 'Việc nhà đã cập nhật',
    message: 'Việc thử nghiệm',
    relatedResourceType: 'CHORE_SCHEDULE',
    relatedResourceId: id,
    relatedDate: date,
    createdAt: `${date}T00:00:00Z`,
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      let body: unknown
      if (url.startsWith('/api/calendar?'))
        body = {
          calendar: {
            from: date,
            to: date,
            timeZone: 'Asia/Ho_Chi_Minh',
            members: [profile],
            occurrences: [],
          },
        }
      else if (url.startsWith('/api/chores?'))
        body = {
          chores: {
            from: date,
            to: date,
            timeZone: 'Asia/Ho_Chi_Minh',
            members: [profile],
            chores: [],
          },
        }
      else if (url === '/api/chores/schedules' && init?.method === 'POST') {
        saved = true
        body = { scheduleId: id }
      } else if (url.endsWith('/read')) {
        readAt = `${date}T01:00:00Z`
        body = { notification: { ...notice, readAt } }
      } else if (url === '/api/notifications')
        body = {
          notifications: saved ? [{ ...notice, readAt }] : [],
          unreadCount: saved && readAt === null ? 1 : 0,
        }
      else throw new Error('Unexpected synthetic request')
      return new Response(JSON.stringify(body), { status: 200 })
    }),
  )
  render(
    <>
      <NotificationPanel />
      <CalendarPage profile={profile} />
    </>,
  )
  const chores = screen.getByRole('region', { name: 'Việc nhà hôm nay' })
  expect(
    await within(chores).findByText('Hôm nay chưa có việc nhà cần làm.'),
  ).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Lịch' })).toBeTruthy()
  fireEvent.click(within(chores).getByRole('button', { name: 'Thêm việc' }))
  fireEvent.change(screen.getByLabelText('Tên việc'), {
    target: { value: 'Việc thử nghiệm' },
  })
  fireEvent.change(screen.getByLabelText('Giao cho'), { target: { value: id } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu việc' }))
  expect(await screen.findByLabelText('1 thông báo chưa đọc')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Thông báo' }))
  expect(await screen.findByText('Việc nhà đã cập nhật')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Đánh dấu đã đọc' })).toBeNull()
  expect(await screen.findByText('Đã đọc')).toBeTruthy()
  expect(screen.queryByLabelText('1 thông báo chưa đọc')).toBeNull()
})
