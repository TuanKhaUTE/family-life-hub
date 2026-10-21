import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { FamilyProfile } from '../auth/auth-api'
import { BreakfastSection } from './BreakfastSection'
import type {
  BreakfastCatalogItem,
  BreakfastDay,
  BreakfastDayResponse,
  BreakfastPurchase,
} from './breakfast-api'

const member: FamilyProfile = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Synthetic Member',
  role: 'MEMBER',
  avatarType: 'EMOJI',
  avatarValue: '🌿',
}
const parent: FamilyProfile = {
  ...member,
  id: '22222222-2222-4222-8222-222222222222',
  displayName: 'Synthetic Parent',
  role: 'PARENT',
}
const catalog: BreakfastCatalogItem[] = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Phở',
    displayOrder: 1,
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Bánh mì',
    displayOrder: 2,
  },
]

function response(
  overrides: Partial<BreakfastDayResponse> = {},
): BreakfastDayResponse {
  return {
    member: {
      id: member.id,
      displayName: member.displayName,
      avatarType: member.avatarType,
      avatarValue: member.avatarValue,
    },
    state: 'NO_RESPONSE',
    catalogItem: null,
    customText: null,
    updatedAt: null,
    ...overrides,
  }
}

function day(overrides: Partial<BreakfastDay> = {}): BreakfastDay {
  return {
    date: '2026-10-22',
    deadlineAt: '2026-10-21T17:00:00.000Z',
    timeZone: 'Asia/Ho_Chi_Minh',
    isOpen: true,
    purchase: null,
    responses: [response()],
    ...overrides,
  }
}

const purchase: BreakfastPurchase = {
  id: '88888888-8888-4888-8888-888888888888',
  breakfastDate: '2026-10-22',
  confirmedBy: { id: parent.id, displayName: parent.displayName },
  message: 'Nước cam trong tủ lạnh nha',
  purchasedAt: '2026-10-21T12:00:00.000Z',
  createdAt: '2026-10-21T12:00:00.000Z',
  updatedAt: '2026-10-21T12:00:00.000Z',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function successfulFetch(initialDay = day()) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/breakfast/days/next') {
      return jsonResponse({ day: initialDay })
    }
    if (url === '/api/breakfast/catalog') {
      return jsonResponse({ items: catalog })
    }
    if (url.endsWith('/response') && init?.method === 'PUT') {
      const body = JSON.parse(init.body as string) as {
        state: BreakfastDayResponse['state']
        catalogItemId?: string
        customText?: string
      }
      return jsonResponse({
        response:
          body.state === 'SELECTED'
            ? response({
                state: 'SELECTED',
                catalogItem: catalog.find(
                  (item) => item.id === body.catalogItemId,
                )!,
                updatedAt: '2026-10-21T12:00:00.000Z',
              })
            : response({
                state: body.state,
                customText: body.customText ?? null,
                updatedAt: '2026-10-21T12:00:00.000Z',
              }),
      })
    }
    throw new Error(`Unexpected URL: ${url}`)
  })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('member breakfast flow', () => {
  it('uses Vietnamese for the primary breakfast actions', async () => {
    vi.stubGlobal('fetch', successfulFetch())
    render(<BreakfastSection profile={member} />)

    expect(
      await screen.findByRole('heading', { name: 'Bữa sáng' }),
    ).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Không ăn' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Lưu lựa chọn bữa sáng' }),
    ).toBeTruthy()
  })
  it('restores a saved choice and lets the member change it before deadline', async () => {
    const user = userEvent.setup()
    const initialDay = day({
      responses: [
        response({
          state: 'SELECTED',
          catalogItem: { id: catalog[0].id, name: catalog[0].name },
          updatedAt: '2026-10-21T10:00:00.000Z',
        }),
      ],
    })
    const fetchMock = successfulFetch(initialDay)
    vi.stubGlobal('fetch', fetchMock)

    render(<BreakfastSection profile={member} />)

    expect(await screen.findByText('Đã lưu bữa sáng')).toBeTruthy()
    expect(screen.getByText('Phở')).toBeTruthy()
    expect(screen.queryByRole('radio', { name: 'Phở' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Đổi lựa chọn' }))
    expect(
      (screen.getByRole('radio', { name: 'Phở' }) as HTMLInputElement).checked,
    ).toBe(true)

    await user.click(screen.getByRole('radio', { name: 'Bánh mì' }))
    await user.click(screen.getByRole('button', { name: 'Cập nhật lựa chọn bữa sáng' }))

    expect(await screen.findByText('Đã lưu bữa sáng')).toBeTruthy()
    expect(screen.getByText('Bánh mì')).toBeTruthy()
    expect(screen.queryByRole('radio', { name: 'Bánh mì' })).toBeNull()
    const saveCall = fetchMock.mock.calls.find(
      ([url]) => url === '/api/breakfast/days/2026-10-22/response',
    )
    expect(JSON.parse(saveCall?.[1]?.body as string)).toEqual({
      state: 'SELECTED',
      catalogItemId: catalog[1].id,
    })
  })

  it('submits a trimmed custom choice', async () => {
    const user = userEvent.setup()
    const fetchMock = successfulFetch()
    vi.stubGlobal('fetch', fetchMock)
    render(<BreakfastSection profile={member} />)

    await screen.findByRole('radio', { name: 'Món khác / tự nhập' })
    await user.click(screen.getByRole('radio', { name: 'Món khác / tự nhập' }))
    await user.type(screen.getByLabelText('Món ăn sáng của bạn'), '  Cháo gà  ')
    await user.click(screen.getByRole('button', { name: 'Lưu lựa chọn bữa sáng' }))

    expect(await screen.findByText('Đã lưu bữa sáng')).toBeTruthy()
    expect(screen.getByText('Cháo gà')).toBeTruthy()
    expect(screen.queryByRole('radio', { name: 'Món khác / tự nhập' })).toBeNull()
    const saveCall = fetchMock.mock.calls.find(
      ([url]) => url === '/api/breakfast/days/2026-10-22/response',
    )
    expect(JSON.parse(saveCall?.[1]?.body as string)).toEqual({
      state: 'CUSTOM',
      customText: 'Cháo gà',
    })
  })

  it('submits Not eating as a distinct response', async () => {
    const user = userEvent.setup()
    const fetchMock = successfulFetch()
    vi.stubGlobal('fetch', fetchMock)
    render(<BreakfastSection profile={member} />)

    await screen.findByRole('radio', { name: 'Không ăn' })
    await user.click(screen.getByRole('radio', { name: 'Không ăn' }))
    await user.click(screen.getByRole('button', { name: 'Lưu lựa chọn bữa sáng' }))

    expect(await screen.findByText('Đã lưu bữa sáng')).toBeTruthy()
    expect(screen.getByText('Không ăn')).toBeTruthy()
  })

  it('shows a closed state without editable choices after cutoff', async () => {
    vi.stubGlobal('fetch', successfulFetch(day({ isOpen: false })))

    render(<BreakfastSection profile={member} />)

    expect(await screen.findByText('Đã hết giờ chọn bữa sáng')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Lưu lựa chọn bữa sáng' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Đổi lựa chọn' })).toBeNull()
  })

  it('moves an open page to the closed state when the deadline passes before save', async () => {
    const user = userEvent.setup()
    const fetchMock = successfulFetch()
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/response') && init?.method === 'PUT') {
        return jsonResponse(
          {
            error: {
              code: 'BREAKFAST_CLOSED',
              message: 'internal deadline wording',
            },
          },
          409,
        )
      }
      if (url === '/api/breakfast/days/next') return jsonResponse({ day: day() })
      return jsonResponse({ items: catalog })
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<BreakfastSection profile={member} />)

    await screen.findByRole('radio', { name: 'Không ăn' })
    await user.click(screen.getByRole('radio', { name: 'Không ăn' }))
    await user.click(screen.getByRole('button', { name: 'Lưu lựa chọn bữa sáng' }))

    expect(await screen.findByText('Đã hết giờ chọn bữa sáng')).toBeTruthy()
    expect(screen.queryByText('internal deadline wording')).toBeNull()
  })

  it('prevents duplicate saves while a request is pending', async () => {
    let resolveSave: ((value: Response) => void) | undefined
    const pendingSave = new Promise<Response>((resolve) => {
      resolveSave = resolve
    })
    const fetchMock = successfulFetch()
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/response') && init?.method === 'PUT') return pendingSave
      if (url === '/api/breakfast/days/next') return jsonResponse({ day: day() })
      return jsonResponse({ items: catalog })
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<BreakfastSection profile={member} />)

    await screen.findByRole('radio', { name: 'Không ăn' })
    fireEvent.click(screen.getByRole('radio', { name: 'Không ăn' }))
    const form = screen.getByRole('button', { name: 'Lưu lựa chọn bữa sáng' }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(
      fetchMock.mock.calls.filter(([url]) => url.endsWith('/response')),
    ).toHaveLength(1)
    resolveSave?.(
      jsonResponse({ response: response({ state: 'NOT_EATING' }) }),
    )
    await screen.findByText('Đã lưu bữa sáng')
  })

  it('shows a safe load error and can retry', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('private network detail'))
      .mockResolvedValueOnce(jsonResponse({ items: catalog }))
      .mockResolvedValueOnce(jsonResponse({ day: day() }))
      .mockResolvedValueOnce(jsonResponse({ items: catalog }))
    vi.stubGlobal('fetch', fetchMock)

    render(<BreakfastSection profile={member} />)

    expect(await screen.findByText('Hiện chưa thể tải thông tin bữa sáng.')).toBeTruthy()
    expect(screen.queryByText('private network detail')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Thử tải lại bữa sáng' }))

    expect(await screen.findByRole('radio', { name: 'Phở' })).toBeTruthy()
  })

  it('shows Mom’s purchase confirmation and optional message', async () => {
    vi.stubGlobal('fetch', successfulFetch(day({ purchase })))
    render(<BreakfastSection profile={member} />)

    expect(await screen.findByText('Mẹ đã mua bữa sáng ✓')).toBeTruthy()
    expect(screen.getByText('Nước cam trong tủ lạnh nha')).toBeTruthy()
  })
})

describe('parent breakfast view', () => {
  it('shows each child status distinctly and no choice form', async () => {
    const statuses: BreakfastDayResponse[] = [
      response({ state: 'SELECTED', catalogItem: { id: catalog[0].id, name: 'Phở' } }),
      response({
        member: { ...response().member, id: '55555555-5555-4555-8555-555555555555', displayName: 'Custom child' },
        state: 'CUSTOM',
        customText: 'Cháo gà',
      }),
      response({
        member: { ...response().member, id: '66666666-6666-4666-8666-666666666666', displayName: 'Not eating child' },
        state: 'NOT_EATING',
      }),
      response({
        member: { ...response().member, id: '77777777-7777-4777-8777-777777777777', displayName: 'No response child' },
      }),
    ]
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ day: day({ responses: statuses }) }),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<BreakfastSection profile={parent} />)

    expect(await screen.findByText('Đã chọn · Phở')).toBeTruthy()
    expect(screen.getByText('Món tự chọn · Cháo gà')).toBeTruthy()
    expect(screen.getByText('Không ăn')).toBeTruthy()
    expect(screen.getByText('Chưa trả lời')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Lưu lựa chọn bữa sáng' })).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('lets Mom confirm purchase with a message and then edit it', async () => {
    const user = userEvent.setup()
    const initial = day()
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/breakfast/days/next') return jsonResponse({ day: initial })
      if (url.endsWith('/purchase') && init?.method === 'PUT') {
        const body = JSON.parse(init.body as string) as { message: string | null }
        return jsonResponse({ purchase: { ...purchase, message: body.message } })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<BreakfastSection profile={parent} />)

    const input = await screen.findByLabelText('Lời nhắn cho cả nhà')
    await user.type(input, '  Nước cam trong tủ lạnh nha  ')
    await user.click(screen.getByRole('button', { name: 'Xác nhận đã mua' }))

    expect(await screen.findByText('Đã mua bữa sáng ✓')).toBeTruthy()
    expect(screen.getByText('Nước cam trong tủ lạnh nha')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Sửa lời nhắn' }))
    expect(screen.getByRole('button', { name: 'Cập nhật lời nhắn' })).toBeTruthy()
    expect((screen.getByLabelText('Lời nhắn cho cả nhà') as HTMLInputElement).value).toBe(
      'Nước cam trong tủ lạnh nha',
    )
  })

  it('shows a safe purchase error without exposing network details', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/breakfast/days/next') return jsonResponse({ day: day() })
      if (url.endsWith('/purchase') && init?.method === 'PUT') {
        throw new Error('private network detail')
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<BreakfastSection profile={parent} />)

    await screen.findByRole('button', { name: 'Xác nhận đã mua' })
    await user.click(screen.getByRole('button', { name: 'Xác nhận đã mua' }))
    expect(await screen.findByText('Chưa thể xác nhận mua bữa sáng. Vui lòng thử lại.')).toBeTruthy()
    expect(screen.queryByText('private network detail')).toBeNull()
  })
})
