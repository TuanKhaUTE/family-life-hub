import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchHome } from './home-api'

afterEach(() => vi.unstubAllGlobals())
describe('home API boundary', () => {
  it.each([401, 503])(
    'does not reveal error payload on HTTP %s',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({ error: { message: 'private storage detail' } }),
              { status },
            ),
        ),
      )
      await expect(fetchHome(new AbortController().signal)).rejects.toThrow(
        'Home unavailable',
      )
    },
  )
  it.each([
    {
      date: '2099-05-01',
      timeZone: 'Asia/Ho_Chi_Minh',
      actions: [],
      breakfast: null,
      dinner: {},
      recentDishes: [],
    },
    {
      date: '2099-05-01',
      timeZone: 'Asia/Ho_Chi_Minh',
      actions: [],
      breakfast: {
        date: '2099-05-02',
        isOpen: true,
        purchased: false,
        responses: [null],
      },
      dinner: { request: null, meal: null },
      recentDishes: [],
    },
  ])(
    'rejects malformed nested summaries rather than crashing the UI',
    async (home) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ home }))),
      )
      await expect(fetchHome(new AbortController().signal)).rejects.toThrow(
        'Invalid home summary',
      )
    },
  )
  it('uses same-origin session credentials and forwards cancellation', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    await expect(fetchHome(controller.signal)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledWith('/api/home', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  })
})
