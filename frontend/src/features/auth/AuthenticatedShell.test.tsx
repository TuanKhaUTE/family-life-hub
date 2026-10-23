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
  it('opens an accessible account menu from the avatar and restores focus', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ notifications: [] }))),
    )
    render(
      <AuthenticatedShell
        profile={{
          id: '11111111-1111-4111-8111-111111111111',
          displayName: 'Synthetic Member',
          role: 'MEMBER',
          avatarType: null,
          avatarValue: null,
        }}
        isLoggingOut={false}
        error={null}
        onLogout={() => {}}
      />,
    )
    const avatar = screen.getByRole('button', {
      name: 'Mở tài khoản của Synthetic Member',
    })
    await user.click(avatar)
    const menu = screen.getByRole('dialog', { name: 'Tài khoản' })
    expect(within(menu).getByText('Synthetic Member')).toBeTruthy()
    expect(within(menu).getByText('Thành viên')).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Tài khoản' })).toBeNull()
    expect(document.activeElement).toBe(avatar)
    await user.click(avatar)
    await user.click(document.body)
    expect(screen.queryByRole('dialog', { name: 'Tài khoản' })).toBeNull()
  })

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
