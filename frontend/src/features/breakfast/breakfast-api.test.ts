import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  confirmBreakfastPurchase,
  fetchBreakfastCatalog,
  fetchBreakfastDay,
} from './breakfast-api'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('breakfast API client', () => {
  it('requests the authenticated catalog with cookies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Phở',
            displayOrder: 1,
          },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const items = await fetchBreakfastCatalog()

    expect(items).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/breakfast/catalog', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
  })

  it('rejects malformed successful responses with a safe message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ day: { secret: 'detail' } })),
    )

    await expect(fetchBreakfastDay()).rejects.toThrow(
      'Breakfast information is temporarily unavailable.',
    )
  })

  it('does not expose server error details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: { code: 'INTERNAL', message: 'database secret' } },
          500,
        ),
      ),
    )

    await expect(fetchBreakfastCatalog()).rejects.toThrow(
      'Breakfast information is temporarily unavailable.',
    )
  })

  it('confirms purchase with an optional message and credentials', async () => {
    const purchase = {
      id: '22222222-2222-4222-8222-222222222222',
      breakfastDate: '2026-10-22',
      confirmedBy: {
        id: '33333333-3333-4333-8333-333333333333',
        displayName: 'Synthetic Parent',
      },
      message: 'Breakfast is ready',
      purchasedAt: '2026-10-21T12:00:00.000Z',
      createdAt: '2026-10-21T12:00:00.000Z',
      updatedAt: '2026-10-21T12:00:00.000Z',
    }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ purchase }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      confirmBreakfastPurchase('2026-10-22', 'Breakfast is ready'),
    ).resolves.toEqual(purchase)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/breakfast/days/2026-10-22/purchase',
      {
        method: 'PUT',
        body: JSON.stringify({ message: 'Breakfast is ready' }),
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    )
  })
})
