import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../breakfast/BreakfastSection', () => ({
  BreakfastSection: () => <p>Bữa sáng thử nghiệm</p>,
}))
vi.mock('../meals/MealRequestSection', () => ({
  MealRequestSection: () => <p>Bữa trưa và tối thử nghiệm</p>,
}))
import { AuthenticatedShell } from './AuthenticatedShell'
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe('mobile family shell', () => {
  it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
    'shows role-aware five destinations for %s and switches content',
    async (role) => {
      const user = userEvent.setup()
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify({ notifications: [] })),
          ),
      )
      render(
        <AuthenticatedShell
          profile={{
            id: '11111111-1111-4111-8111-111111111111',
            displayName: 'Synthetic Member',
            role,
            avatarType: null,
            avatarValue: null,
          }}
          isLoggingOut={false}
          error={null}
          onLogout={() => {}}
        />,
      )
      const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' })
      expect(
        within(nav)
          .getAllByRole('button')
          .map(
            (button) => button.querySelector('span:last-child')?.textContent,
          ),
      ).toEqual([
        'Trang chủ',
        'Bếp',
        'Lịch',
        role === 'PARENT' ? 'Chi tiêu' : 'Học & Luyện',
        'Cá nhân',
      ])
      expect(screen.queryByText('Bữa sáng thử nghiệm')).toBeNull()
      await user.click(within(nav).getByRole('button', { name: 'Bếp' }))
      expect(screen.getByText('Bữa sáng thử nghiệm')).toBeTruthy()
      expect(screen.getByText('Bữa trưa và tối thử nghiệm')).toBeTruthy()
      await user.click(within(nav).getByRole('button', { name: 'Lịch' }))
      expect(screen.getByRole('heading', { name: 'Lịch' })).toBeTruthy()
      expect(screen.queryByText('Bữa sáng thử nghiệm')).toBeNull()
      await user.click(
        within(nav).getByRole('button', {
          name: role === 'PARENT' ? 'Chi tiêu' : 'Học & Luyện',
        }),
      )
      expect(
        screen.getByRole('heading', {
          name: role === 'PARENT' ? 'Chi tiêu' : 'Học tập & Rèn luyện',
        }),
      ).toBeTruthy()
      await user.click(within(nav).getByRole('button', { name: 'Cá nhân' }))
      expect(screen.getByRole('heading', { name: 'Cá nhân' })).toBeTruthy()
      expect(screen.queryByRole('dialog')).toBeNull()
    },
  )
})
