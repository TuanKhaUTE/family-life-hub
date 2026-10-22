import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
  role: 'MEMBER',
  avatarType: null,
  avatarValue: null,
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('combined duty completion refreshes notifications; only the parent session receives its notice', async () => {
  let completed = false,
    parentSession = false,
    readAt: string | null = null
  const notice = {
    id,
    type: 'HOUSEHOLD_DUTY_COMPLETED',
    title: 'Thử nghiệm đã hoàn thành việc nhà hôm nay',
    message: 'Rửa chén & Đổ rác',
    relatedResourceType: 'HOUSEHOLD_DUTY',
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
      else if (url.startsWith('/api/chores/duties?'))
        body = {
          household: {
            members: [profile],
            duties: [
              {
                id,
                date,
                assignee: profile,
                cancelled: false,
                completedAt: completed ? `${date}T12:00:00Z` : null,
                completedByMemberId: completed ? id : null,
              },
            ],
          },
        }
      else if (url.endsWith('/complete') && init?.method === 'POST') {
        completed = true
        return new Response(null, { status: 204 })
      } else if (url.endsWith('/read') && parentSession) {
        readAt = `${date}T13:00:00Z`
        body = { notification: { ...notice, readAt } }
      } else if (url === '/api/notifications')
        body = {
          notifications:
            completed && parentSession ? [{ ...notice, readAt }] : [],
          unreadCount: completed && parentSession && !readAt ? 1 : 0,
        }
      else throw new Error('Unexpected synthetic request')
      return new Response(JSON.stringify(body))
    }),
  )
  render(
    <>
      <NotificationPanel />
      <CalendarPage profile={profile} />
    </>,
  )
  expect(
    await screen.findByRole('button', { name: 'Hoàn thành việc nhà ✓' }),
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành việc nhà ✓' }))
  expect(await screen.findByText('Đã hoàn thành ✓')).toBeTruthy()
  expect(screen.queryByLabelText('1 thông báo chưa đọc')).toBeNull()
  cleanup()
  parentSession = true
  render(<NotificationPanel />)
  expect(await screen.findByLabelText('1 thông báo chưa đọc')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Thông báo' }))
  expect(await screen.findByText(notice.title)).toBeTruthy()
  expect(await screen.findByText('Đã đọc')).toBeTruthy()
  expect(screen.queryByLabelText('1 thông báo chưa đọc')).toBeNull()
})
