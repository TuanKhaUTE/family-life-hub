import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

import type { FamilyProfile } from './auth-api'

vi.mock('../notifications/NotificationPanel', () => ({
  NotificationPanel: () => null,
}))
vi.mock('../home/HomePage', () => ({
  HomePage: () => <h1>Trang chủ</h1>,
}))
vi.mock('../personal/PersonalPage', () => ({
  PersonalPage: ({
    profile,
    onProfileUpdated,
  }: {
    profile: FamilyProfile
    onProfileUpdated?: (profile: FamilyProfile) => void
  }) => (
    <section>
      <h1>Cá nhân</h1>
      <p>{profile.displayName}</p>
      <button
        type="button"
        onClick={() =>
          onProfileUpdated?.({
            ...profile,
            displayName: 'Synthetic Updated',
            avatarType: 'IMAGE',
            avatarValue: '/api/profile/avatar/' + profile.id + '?v=2',
          })
        }
      >
        Mô phỏng cập nhật hồ sơ
      </button>
    </section>
  ),
}))

import { AuthenticatedShell } from './AuthenticatedShell'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('propagates a profile update to the header and AccountMenu without reload', async () => {
  const user = userEvent.setup()
  const initialProfile: FamilyProfile = {
    id: '11111111-1111-4111-8111-111111111111',
    displayName: 'Synthetic Member',
    role: 'MEMBER',
    avatarType: 'IMAGE',
    avatarValue: '/api/profile/avatar/11111111-1111-4111-8111-111111111111?v=1',
  }

  function Harness() {
    const [profile, setProfile] = useState(initialProfile)
    return (
      <AuthenticatedShell
        profile={profile}
        isLoggingOut={false}
        error={null}
        onLogout={() => {}}
        onProfileUpdated={setProfile}
      />
    )
  }

  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Cá nhân' }))
  await user.click(screen.getByRole('button', { name: 'Mô phỏng cập nhật hồ sơ' }))

  await waitFor(() => {
    expect(screen.getByText('Synthetic Updated')).toBeTruthy()
    expect(document.querySelector('header img')?.getAttribute('src')).toContain(
      '?v=2',
    )
  })

  await user.click(
    screen.getByRole('button', { name: 'Mở tài khoản của Synthetic Updated' }),
  )
  const menu = screen.getByRole('dialog', { name: 'Tài khoản' })
  expect(within(menu).getByText('Synthetic Updated')).toBeTruthy()
  expect(menu.querySelector('img')?.getAttribute('src')).toContain('?v=2')
  expect(
    Array.from(document.querySelectorAll('img')).every((image) =>
      image.src.includes('?v=2'),
    ),
  ).toBe(true)
})
