import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { ProfileAvatar } from './ProfileSelector'

it('falls back to the member initial when an uploaded image fails', () => {
  const { container } = render(
    <ProfileAvatar
      profile={{
        displayName: 'Synthetic Member',
        avatarType: 'IMAGE',
        avatarValue: '/api/profile/avatar/11111111-1111-4111-8111-111111111111?v=1',
      }}
    />,
  )
  fireEvent.error(container.querySelector('img')!)
  expect(screen.getByText('S')).toBeTruthy()
})
