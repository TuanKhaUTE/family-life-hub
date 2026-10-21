import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../breakfast/BreakfastSection', () => ({
  BreakfastSection: () => null,
}))

vi.mock('../notifications/NotificationPanel', () => ({
  NotificationPanel: () => null,
}))

vi.mock('../meals/MealRequestSection', () => ({
  MealRequestSection: () => null,
}))

import { AuthFlow } from './AuthFlow'
import type { FamilyProfile } from './auth-api'

// Authentication tests isolate domain reads; Home interactions have their own suite.
vi.mock('../home/home-api', () => ({
  fetchHome: async () => ({
    date: '2099-05-01',
    timeZone: 'Asia/Ho_Chi_Minh',
    actions: [],
    breakfast: {
      date: '2099-05-02',
      isOpen: true,
      purchased: false,
      responses: [],
    },
    dinner: { request: null, meal: null },
    recentDishes: [],
  }),
}))

const profile: FamilyProfile = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Synthetic Member',
  role: 'MEMBER',
  avatarType: 'EMOJI',
  avatarValue: '🌿',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function signedOutFetch(): ReturnType<typeof vi.fn> {
  return vi
    .fn()
    .mockResolvedValueOnce(
      jsonResponse({ error: { code: 'UNAUTHENTICATED' } }, 401),
    )
    .mockResolvedValueOnce(jsonResponse({ profiles: [profile] }))
}

async function openPinForm(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('heading', { name: 'Hôm nay ai đang dùng?' })
  await user.click(
    screen.getByRole('button', { name: `Tiếp tục với ${profile.displayName}` }),
  )
  return screen.getByLabelText('Mã PIN 6 số') as HTMLInputElement
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AuthFlow', () => {
  it('uses Vietnamese for the primary profile-selection flow', async () => {
    vi.stubGlobal('fetch', signedOutFetch())
    render(<AuthFlow />)

    expect(
      await screen.findByRole('heading', { name: 'Hôm nay ai đang dùng?' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: `Tiếp tục với ${profile.displayName}`,
      }),
    ).toBeTruthy()
  })
  it('restores an authenticated session on app load', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ profile }))
    vi.stubGlobal('fetch', fetchMock)

    render(<AuthFlow />)

    expect(screen.getByRole('status').textContent).toContain(
      'Đang mở không gian gia đình',
    )
    expect(
      await screen.findByRole('heading', {
        name: 'Hôm nay nhà mình có gì?',
      }),
    ).toBeTruthy()
    expect(screen.getByText(new RegExp(profile.displayName))).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('loads family profiles after an unauthenticated session check', async () => {
    const fetchMock = signedOutFetch()
    vi.stubGlobal('fetch', fetchMock)

    render(<AuthFlow />)

    expect(
      await screen.findByRole('button', {
        name: `Tiếp tục với ${profile.displayName}`,
      }),
    ).toBeTruthy()
    expect(screen.queryByText(profile.id)).toBeNull()
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/me',
      '/api/auth/profiles',
    ])
  })

  it('moves from profile selection to PIN entry and back', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', signedOutFetch())
    render(<AuthFlow />)

    const input = await openPinForm(user)
    expect(input.type).toBe('password')
    expect(screen.getByText(`Chào ${profile.displayName}`)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Chọn hồ sơ khác' }))

    expect(
      screen.getByRole('heading', { name: 'Hôm nay ai đang dùng?' }),
    ).toBeTruthy()
  })

  it('requires exactly six digits before PIN submission', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', signedOutFetch())
    render(<AuthFlow />)
    const input = await openPinForm(user)
    const submit = screen.getByRole('button', { name: 'Vào Family Life Hub' })

    await user.type(input, '12a34-5')
    expect(input.value).toBe('12345')
    expect((submit as HTMLButtonElement).disabled).toBe(true)

    await user.type(input, '67')
    expect(input.value).toBe('123456')
    expect((submit as HTMLButtonElement).disabled).toBe(false)
  })

  it('logs in with the safe returned profile and stores no browser token', async () => {
    const user = userEvent.setup()
    const fetchMock = signedOutFetch().mockResolvedValueOnce(
      jsonResponse({ profile }),
    )
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem')
    vi.stubGlobal('fetch', fetchMock)
    render(<AuthFlow />)
    const input = await openPinForm(user)

    await user.type(input, '123456')
    await user.click(
      screen.getByRole('button', { name: 'Vào Family Life Hub' }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Hôm nay nhà mình có gì?',
      }),
    ).toBeTruthy()
    expect(screen.getByText(new RegExp(profile.displayName))).toBeTruthy()
    const loginCall = fetchMock.mock.calls[2]
    expect(loginCall?.[0]).toBe('/api/auth/login')
    expect(JSON.parse(loginCall?.[1]?.body as string)).toEqual({
      memberId: profile.id,
      pin: '123456',
    })
    expect(storageSpy).not.toHaveBeenCalled()
  })

  it('shows one safe login error and clears the submitted PIN', async () => {
    const user = userEvent.setup()
    const fetchMock = signedOutFetch().mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'LOCKED_DETAIL',
            message: 'sensitive lockout detail',
          },
        },
        401,
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<AuthFlow />)
    const input = await openPinForm(user)

    await user.type(input, '123456')
    await user.click(
      screen.getByRole('button', { name: 'Vào Family Life Hub' }),
    )

    expect(
      await screen.findByText('Không thể xác minh hồ sơ hoặc mã PIN.'),
    ).toBeTruthy()
    expect(input.value).toBe('')
    expect(screen.queryByText('sensitive lockout detail')).toBeNull()
  })

  it('prevents duplicate login submissions while one is pending', async () => {
    const user = userEvent.setup()
    let resolveLogin: ((response: Response) => void) | undefined
    const pendingLogin = new Promise<Response>((resolve) => {
      resolveLogin = resolve
    })
    const fetchMock = signedOutFetch().mockReturnValueOnce(pendingLogin)
    vi.stubGlobal('fetch', fetchMock)
    render(<AuthFlow />)
    const input = await openPinForm(user)

    await user.type(input, '123456')
    const form = screen.getByLabelText('Mã PIN 6 số').closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(
      fetchMock.mock.calls.filter(([url]) => url === '/api/auth/login'),
    ).toHaveLength(1)

    resolveLogin?.(jsonResponse({ profile }))
    expect(
      await screen.findByRole('heading', {
        name: 'Hôm nay nhà mình có gì?',
      }),
    ).toBeTruthy()
  })

  it('logs out, clears the in-memory profile, and reloads profile choices', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ profile }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ profiles: [profile] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<AuthFlow />)

    await screen.findByRole('heading', {
      name: 'Hôm nay nhà mình có gì?',
    })
    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }))

    expect(
      await screen.findByRole('heading', { name: 'Hôm nay ai đang dùng?' }),
    ).toBeTruthy()
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/me',
      '/api/auth/logout',
      '/api/auth/profiles',
    ])
  })

  it('offers a working retry after an initial network error', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network detail'))
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: 'UNAUTHENTICATED' } }, 401),
      )
      .mockResolvedValueOnce(jsonResponse({ profiles: [profile] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<AuthFlow />)

    expect(
      await screen.findByRole('heading', { name: 'Chưa thể mở cửa' }),
    ).toBeTruthy()
    expect(screen.queryByText('network detail')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Thử lại' }))

    expect(
      await screen.findByRole('heading', { name: 'Hôm nay ai đang dùng?' }),
    ).toBeTruthy()
  })

  it('keeps logout retryable when the request cannot be confirmed', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ profile }))
      .mockRejectedValueOnce(new TypeError('network detail'))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ profiles: [profile] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<AuthFlow />)

    await screen.findByRole('heading', {
      name: 'Hôm nay nhà mình có gì?',
    })
    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }))

    expect(
      await screen.findByText(
        'Không thể xác nhận đăng xuất. Vui lòng thử lại.',
      ),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }))

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Hôm nay ai đang dùng?' }),
      ).toBeTruthy()
    })
  })
})
