import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
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
  it('does not acknowledge hidden items; opening automatically reads only shown unread items and updates badge', async () => {
    const user = userEvent.setup(),
      read = { ...notification, readAt: '2026-10-22T01:00:00Z' },
      older = {
        ...notification,
        id: '33333333-3333-4333-8333-333333333333',
        title: 'Older read item',
        createdAt: '2026-10-20T00:00:00Z',
        readAt: '2026-10-20T01:00:00Z',
      }
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json({ notifications: [older, notification], unreadCount: 3 }),
      )
      .mockResolvedValueOnce(json({ notification: read }))
    vi.stubGlobal('fetch', fetch)
    render(<NotificationPanel />)
    await screen.findByLabelText('3 thông báo chưa đọc')
    expect(fetch).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Thông báo' }))
    await waitFor(() =>
      expect(screen.getByLabelText('2 thông báo chưa đọc')).toBeTruthy(),
    )
    expect(screen.getAllByRole('listitem')[0].textContent).toContain(
      notification.title,
    )
    expect(screen.getByText(/19:00/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Đánh dấu đã đọc' })).toBeNull()
    expect(fetch).toHaveBeenCalledWith(
      '/api/notifications/' + notification.id + '/read',
      expect.objectContaining({ method: 'PATCH' }),
    )
    await user.click(screen.getByRole('button', { name: 'Đóng thông báo' }))
    await user.click(screen.getByRole('button', { name: 'Thông báo' }))
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('removes the badge only after acknowledgement succeeds', async () => {
    const user = userEvent.setup()
    let acknowledge!: (r: Response) => void
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ notifications: [notification] }))
        .mockImplementationOnce(
          () => new Promise<Response>((r) => (acknowledge = r)),
        ),
    )
    renderPanel()
    await screen.findByText(notification.message)
    expect(screen.getByLabelText('1 thông báo chưa đọc')).toBeTruthy()
    acknowledge(
      json({
        notification: { ...notification, readAt: '2026-10-22T00:00:00Z' },
      }),
    )
    await waitFor(() =>
      expect(screen.queryByLabelText(/thông báo chưa đọc/)).toBeNull(),
    )
    await user.keyboard('{Escape}')
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Thông báo' }),
    )
  })
  it('keeps failed acknowledgements unread and provides safe retry', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ notifications: [notification] }))
        .mockRejectedValueOnce(new Error('private detail'))
        .mockResolvedValueOnce(
          json({
            notification: { ...notification, readAt: '2026-10-22T00:00:00Z' },
          }),
        ),
    )
    renderPanel()
    await screen.findByRole('alert')
    expect(screen.getByLabelText('1 thông báo chưa đọc')).toBeTruthy()
    expect(screen.getByText('Mới')).toBeTruthy()
    expect(screen.queryByText('private detail')).toBeNull()
    await user.click(
      screen.getByRole('button', { name: 'Thử xác nhận đã xem' }),
    )
    await screen.findByText('Đã đọc')
    expect(screen.queryByLabelText(/thông báo chưa đọc/)).toBeNull()
  })
  it('auto-reads newly loaded items while open without rereading previous items', async () => {
    const user = userEvent.setup(),
      read = { ...notification, readAt: '2026-10-22T00:00:00Z' },
      next = {
        ...notification,
        id: '33333333-3333-4333-8333-333333333333',
        title: 'Bữa tối đã sẵn sàng',
      }
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ notifications: [notification] }))
      .mockResolvedValueOnce(json({ notification: read }))
      .mockResolvedValueOnce(
        json({
          notifications: [{ ...read, message: 'Lời nhắn đã cập nhật' }, next],
        }),
      )
      .mockResolvedValueOnce(
        json({ notification: { ...next, readAt: '2026-10-22T01:00:00Z' } }),
      )
    vi.stubGlobal('fetch', fetch)
    renderPanel()
    await screen.findByText('Đã đọc')
    fireEvent(window, new Event('family-notifications-changed'))
    await screen.findByText(next.title)
    await screen.findByText('Lời nhắn đã cập nhật')
    await waitFor(() => expect(screen.getAllByText('Đã đọc')).toHaveLength(2))
    await user.click(screen.getByRole('button', { name: 'Đóng thông báo' }))
    expect(
      fetch.mock.calls.filter((c) => c[1]?.method === 'PATCH'),
    ).toHaveLength(2)
  })
  it('shows loading and a safe fetch failure with retry', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new Error('private detail'))
        .mockResolvedValueOnce(json({ notifications: [] })),
    )
    renderPanel()
    expect(screen.getByRole('status').textContent).toContain('Đang tải')
    await user.click(await screen.findByRole('button', { name: 'Thử tải lại' }))
    await screen.findByText('Hiện chưa có thông báo nào.')
    expect(screen.queryByText('private detail')).toBeNull()
  })
  it('closes outside and with Escape and restores keyboard focus', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ notifications: [] })),
    )
    render(<NotificationPanel />)
    const bell = screen.getByRole('button', { name: 'Thông báo' })
    await user.click(bell)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(bell)
    await user.click(bell)
    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
