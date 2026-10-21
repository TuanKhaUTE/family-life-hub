import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NotificationPanel } from './NotificationPanel'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const notification = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'BREAKFAST_PURCHASED',
  title: 'Breakfast purchased',
  message: 'Breakfast is ready',
  relatedResourceType: 'BREAKFAST_PURCHASE',
  relatedResourceId: '22222222-2222-4222-8222-222222222222',
  relatedDate: '2026-10-22',
  readAt: null,
  createdAt: '2026-10-21T12:00:00.000Z',
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('NotificationPanel', () => {
  it('uses Vietnamese notification labels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ notifications: [notification] })),
    )
    render(<NotificationPanel />)

    expect(
      await screen.findByRole('heading', { name: 'Thông báo' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Đánh dấu đã đọc' }),
    ).toBeTruthy()
  })
  it('shows a calm loading state while notifications are pending', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)))
    render(<NotificationPanel />)
    expect(screen.getByRole('status').textContent).toContain(
      'Đang tải thông báo',
    )
  })

  it('shows unread notifications and marks one read', async () => {
    const user = userEvent.setup()
    const read = { ...notification, readAt: '2026-10-21T13:00:00.000Z' }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ notifications: [notification] }))
      .mockResolvedValueOnce(json({ notification: read }))
    vi.stubGlobal('fetch', fetchMock)

    render(<NotificationPanel />)

    expect(await screen.findByText('Breakfast is ready')).toBeTruthy()
    expect(screen.getByText('Mới')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Đánh dấu đã đọc' }))
    expect(await screen.findByText('Đã đọc')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Đánh dấu đã đọc' })).toBeNull()
  })

  it('shows a safe error and retries', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('private detail'))
      .mockResolvedValueOnce(json({ notifications: [] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<NotificationPanel />)

    expect(await screen.findByText('Hiện chưa thể tải thông báo.')).toBeTruthy()
    expect(screen.queryByText('private detail')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    expect(await screen.findByText('Hiện chưa có thông báo nào.')).toBeTruthy()
  })

  it('keeps a failed mark-read action retryable', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ notifications: [notification] }))
      .mockRejectedValueOnce(new Error('private detail'))
    vi.stubGlobal('fetch', fetchMock)
    render(<NotificationPanel />)

    await screen.findByText('Breakfast is ready')
    await user.click(screen.getByRole('button', { name: 'Đánh dấu đã đọc' }))
    expect(await screen.findByText('Chưa thể đánh dấu thông báo đã đọc.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Đánh dấu đã đọc' })).toBeTruthy()
  })
})
