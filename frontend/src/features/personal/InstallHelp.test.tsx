import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  it('hides install help when the app is already standalone', () => {
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      value: true,
    })

    render(<InstallHelp />)

    expect(screen.queryByRole('heading', { name: 'Cài Family Life Hub' })).toBeNull()
  })
  it('uses the native install prompt when the browser provides one', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36',
    })
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      value: false,
    })
    render(<InstallHelp />)
    const prompt = vi.fn().mockResolvedValue(undefined)
    const event = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
    }
    event.preventDefault = vi.fn()
    event.prompt = prompt
    event.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(event)

    await user.click(await screen.findByRole('button', { name: 'Cài ứng dụng' }))
    expect(event.preventDefault).toHaveBeenCalled()
    expect(prompt).toHaveBeenCalledTimes(1)
  })
})
