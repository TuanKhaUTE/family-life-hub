import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthenticatedShell } from '../auth/AuthenticatedShell'
import { familyDate } from './family-time'

const id = '11111111-1111-4111-8111-111111111111'
const dishId = '22222222-2222-4222-8222-222222222222'
const member = {
  id,
  displayName: 'Synthetic Member',
  avatarType: null,
  avatarValue: null,
}
function json(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200 })
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe('integrated daily kitchen', () => {
  it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
    'keeps three daily regions and compact feedback for %s with the existing bell/navigation',
    async (role) => {
      const user = userEvent.setup()
      const fetchMock = vi.fn(async (url: string) => {
        if (url === '/api/notifications')
          return json({ notifications: [], unreadCount: 0 })
        if (url === '/api/breakfast/catalog') return json({ items: [] })
        if (url === '/api/breakfast/days/next')
          return json({
            day: {
              date: '2099-05-02',
              deadlineAt: '2099-05-01T17:00:00Z',
              timeZone: 'Asia/Ho_Chi_Minh',
              isOpen: true,
              purchase: null,
              responses: [
                {
                  member,
                  state: 'CUSTOM',
                  catalogItem: null,
                  customText: 'Phở',
                  updatedAt: null,
                },
              ],
            },
          })
        if (url === '/api/meals/requests/current') return json({ requests: [] })
        if (url === `/api/meals/final/${familyDate()}/DINNER`)
          return json({
            meal: {
              id,
              mealDate: familyDate(),
              mealType: 'DINNER',
              mealRequestId: null,
              finalizedByMemberId: id,
              readyAt: '2099-05-01T11:00:00Z',
              readyMessage: 'Canh còn nóng nhé',
              createdAt: '2099-05-01T10:00:00Z',
              updatedAt: '2099-05-01T11:00:00Z',
              dishes: [
                {
                  id: dishId,
                  name: 'Canh cải',
                  category: 'SOUP',
                  sortOrder: 0,
                },
              ],
            },
          })
        throw new Error('Unexpected synthetic API path')
      })
      vi.stubGlobal('fetch', fetchMock)
      const { container } = render(
        <AuthenticatedShell
          profile={{ ...member, role }}
          isLoggingOut={false}
          error={null}
          onLogout={() => {}}
        />,
      )
      await user.click(screen.getByRole('button', { name: 'Bếp' }))
      const breakfast = await screen.findByRole('region', {
        name: 'Bữa sáng tiếp theo',
      })
      const dinner = await screen.findByRole('region', {
        name: 'Bữa tối hôm nay',
      })
      const finalized = await screen.findByRole('region', {
        name: 'Bữa tối đã chốt',
      })
      expect(breakfast.className).toContain('breakfast-card')
      expect(dinner.className).toContain('meals-card')
      expect(finalized.className).toContain('final-meal-section')
      await within(finalized).findByRole('button', {
        name: role === 'PARENT' ? 'Xem góp ý bữa ăn' : 'Đánh giá bữa tối',
      })
      expect(
        container.querySelector(
          'input[type="date"],input[type="datetime-local"]',
        ),
      ).toBeNull()
      expect(screen.queryByText('Bữa trưa')).toBeNull()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(
        fetchMock.mock.calls.some(([url]) => url.endsWith('/ratings')),
      ).toBe(false)
      expect(screen.getByRole('button', { name: 'Thông báo' })).toBeTruthy()
      expect(
        within(
          screen.getByRole('navigation', { name: 'Điều hướng chính' }),
        ).getAllByRole('button'),
      ).toHaveLength(5)
    },
  )
})
