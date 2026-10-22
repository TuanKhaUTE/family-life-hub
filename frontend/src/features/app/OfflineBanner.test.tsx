import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OfflineBanner } from './OfflineBanner'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('OfflineBanner', () => {
  it('shows a friendly non-actionable state while offline and clears when online', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    })
    render(<OfflineBanner />)
    expect(screen.getByRole('status').textContent).toBe(
      'Bạn đang ngoại tuyến. Các thao tác cần mạng sẽ chưa được gửi.',
    )

    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    })
    window.dispatchEvent(new Event('online'))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })
})
