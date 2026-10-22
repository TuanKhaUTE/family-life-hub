import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InstallHelp } from './InstallHelp'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('InstallHelp', () => {
  it('shows calm iPhone Safari instructions without an install nag', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
    })
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      value: false,
    })

    render(<InstallHelp />)

    expect(screen.getByRole('heading', { name: 'Cài Family Life Hub' })).toBeTruthy()
    expect(screen.getByText('Chia sẻ → Thêm vào Màn hình chính')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cài ứng dụng' })).toBeNull()
  })
})
