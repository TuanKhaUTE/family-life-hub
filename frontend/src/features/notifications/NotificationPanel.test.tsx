import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NotificationPanel } from './NotificationPanel'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderPanel() {
  render(<NotificationPanel />)
  fireEvent.click(screen.getByRole('button', { name: 'Thông báo' }))
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
  it('shows only the bell initially, closes outside and with Escape, and restores focus', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ notifications: [] })),
    )
    render(<NotificationPanel />)
    const bell = screen.getByRole('button', { name: 'Thông báo' })
    expect(screen.queryByRole('heading', { name: 'Thông báo' })).toBeNull()
    expect(screen.queryByLabelText(/thông báo chưa đọc/)).toBeNull()
    await user.click(bell)
    expect(screen.getByRole('dialog', { name: 'Thông báo' })).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(bell)
    await user.click(bell)
    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('sorts newest first and removes the badge after the final unread item is read', async () => {
    const user = userEvent.setup()
    const newer = {
      ...notification,
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Thông báo mới',
      readAt: '2099-01-01T00:00:00Z',
      createdAt: '2099-01-01T00:00:00Z',
    }
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ notifications: [notification, newer] }))
        .mockResolvedValueOnce(
          json({
            notification: { ...notification, readAt: '2099-01-01T00:00:00Z' },
          }),
        ),
    )
    render(<NotificationPanel />)
    expect(await screen.findByLabelText('1 thông báo chưa đọc')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Thông báo' }))
    expect(screen.getAllByRole('listitem')[0].textContent).toContain(
      'Thông báo mới',
    )
    await user.click(screen.getByRole('button', { name: 'Đánh dấu đã đọc' }))
    await screen.findAllByText('Đã đọc')
    expect(screen.queryByLabelText(/thông báo chưa đọc/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Đóng thông báo' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('refreshes and displays meal-ready notifications with the existing read action', async () => {
    const user = userEvent.setup()
    const readyNotification = {
      ...notification,
      type: 'MEAL_READY',
      title: 'Bữa tối đã sẵn sàng ✓',
      message: 'Canh ở trong nồi nhé',
      relatedResourceType: 'FINAL_MEAL',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ notifications: [] }))
      .mockResolvedValueOnce(json({ notifications: [readyNotification] }))
      .mockResolvedValueOnce(
        json({
          notification: {
            ...readyNotification,
            readAt: '2099-05-01T12:00:00Z',
          },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)
    renderPanel()
    await screen.findByText('Hiện chưa có thông báo nào.')
    fireEvent(window, new Event('family-notifications-changed'))
    expect(await screen.findByText('Bữa tối đã sẵn sàng ✓')).toBeTruthy()
    expect(screen.getByText('Canh ở trong nồi nhé')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Đánh dấu đã đọc' }))
    expect(await screen.findByText('Đã đọc')).toBeTruthy()
  })
  it('uses Vietnamese notification labels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ notifications: [notification] })),
    )
    renderPanel()

    expect(
      await screen.findByRole('heading', { name: 'Thông báo' }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Đánh dấu đã đọc' })).toBeTruthy()
  })
  it('shows a calm loading state while notifications are pending', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    )
    renderPanel()
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

    renderPanel()

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
    renderPanel()

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
    renderPanel()

    await screen.findByText('Breakfast is ready')
    await user.click(screen.getByRole('button', { name: 'Đánh dấu đã đọc' }))
    expect(
      await screen.findByText('Chưa thể đánh dấu thông báo đã đọc.'),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Đánh dấu đã đọc' })).toBeTruthy()
  })
})
