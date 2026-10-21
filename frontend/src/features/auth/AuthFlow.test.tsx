import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthFlow } from './AuthFlow'
import type { FamilyProfile } from './auth-api'

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
  await screen.findByRole('heading', { name: 'Who’s home today?' })
  await user.click(
    screen.getByRole('button', { name: `Continue as ${profile.displayName}` }),
  )
  return screen.getByLabelText('6-digit PIN') as HTMLInputElement
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AuthFlow', () => {
  it('restores an authenticated session on app load', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ profile }))
    vi.stubGlobal('fetch', fetchMock)

    render(<AuthFlow />)

    expect(screen.getByRole('status').textContent).toContain(
      'Opening your family home',
    )
    expect(
      await screen.findByRole('heading', {
        name: `Welcome home, ${profile.displayName}`,
      }),
    ).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('loads family profiles after an unauthenticated session check', async () => {
    const fetchMock = signedOutFetch()
    vi.stubGlobal('fetch', fetchMock)

    render(<AuthFlow />)

    expect(
      await screen.findByRole('button', {
        name: `Continue as ${profile.displayName}`,
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
    expect(screen.getByText(`Hi, ${profile.displayName}`)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Choose another profile' }))

    expect(
      screen.getByRole('heading', { name: 'Who’s home today?' }),
    ).toBeTruthy()
  })

  it('requires exactly six digits before PIN submission', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', signedOutFetch())
    render(<AuthFlow />)
    const input = await openPinForm(user)
    const submit = screen.getByRole('button', { name: 'Enter Family Life Hub' })

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
    await user.click(screen.getByRole('button', { name: 'Enter Family Life Hub' }))

    expect(
      await screen.findByRole('heading', {
        name: `Welcome home, ${profile.displayName}`,
      }),
    ).toBeTruthy()
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
    await user.click(screen.getByRole('button', { name: 'Enter Family Life Hub' }))

    expect(
      await screen.findByText('Couldn’t verify that profile and PIN.'),
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
    const form = screen.getByLabelText('6-digit PIN').closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(
      fetchMock.mock.calls.filter(([url]) => url === '/api/auth/login'),
    ).toHaveLength(1)

    resolveLogin?.(jsonResponse({ profile }))
    expect(
      await screen.findByRole('heading', {
        name: `Welcome home, ${profile.displayName}`,
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
      name: `Welcome home, ${profile.displayName}`,
    })
    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(
      await screen.findByRole('heading', { name: 'Who’s home today?' }),
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
      await screen.findByRole('heading', { name: 'We couldn’t open the door' }),
    ).toBeTruthy()
    expect(screen.queryByText('network detail')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('heading', { name: 'Who’s home today?' }),
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
      name: `Welcome home, ${profile.displayName}`,
    })
    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(
      await screen.findByText('We couldn’t confirm logout. Please try again.'),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Log out' }))

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Who’s home today?' }),
      ).toBeTruthy()
    })
  })
})
