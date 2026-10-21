import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchNotifications, markNotificationRead } from './notification-api'

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

afterEach(() => vi.unstubAllGlobals())

describe('notification API client', () => {
  it('lists safe notifications with the session cookie', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ notifications: [notification] }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchNotifications()).resolves.toEqual([notification])
    expect(fetchMock).toHaveBeenCalledWith('/api/notifications', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
  })

  it('marks a notification read with the session cookie', async () => {
    const read = { ...notification, readAt: '2026-10-21T13:00:00.000Z' }
    const fetchMock = vi.fn().mockResolvedValue(json({ notification: read }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(markNotificationRead(notification.id)).resolves.toEqual(read)
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/notifications/${notification.id}/read`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      },
    )
  })

  it('uses a safe error for malformed and failed responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ secret: 'detail' })))
    await expect(fetchNotifications()).rejects.toThrow(
      'Notifications are temporarily unavailable.',
    )
  })
})
