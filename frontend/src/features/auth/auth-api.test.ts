import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  AuthApiError,
  getCurrentProfile,
  getFamilyProfiles,
  loginWithPin,
  logout,
  type FamilyProfile,
} from './auth-api'

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

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('auth API', () => {
  it('restores a safe current profile with a relative request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ profile }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getCurrentProfile()).resolves.toEqual(profile)
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
  })

  it('treats a 401 session check as signed out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: { code: 'UNAUTHENTICATED', message: 'safe' } },
          401,
        ),
      ),
    )

    await expect(getCurrentProfile()).resolves.toBeNull()
  })

  it('loads active profile choices from the auth API', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ profiles: [profile] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getFamilyProfiles()).resolves.toEqual([profile])
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/profiles', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
  })

  it('posts the selected member and PIN without requesting a token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ profile }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(loginWithPin(profile.id, '123456')).resolves.toEqual(profile)
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ memberId: profile.id, pin: '123456' }),
    })
  })

  it('preserves only the response status in client-facing API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'INTERNAL_DETAIL',
              message: 'sensitive upstream detail',
            },
          },
          503,
        ),
      ),
    )

    const error = await loginWithPin(profile.id, '123456').catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(AuthApiError)
    expect(error).toMatchObject({ status: 503, message: 'Auth request failed' })
    expect(String(error)).not.toContain('sensitive upstream detail')
  })

  it('posts logout and accepts the empty success response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(logout()).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
  })

  it('rejects a malformed profile response instead of trusting it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ profile: { id: profile.id, displayName: 42 } }),
      ),
    )

    await expect(getCurrentProfile()).rejects.toMatchObject({ status: 0 })
  })
})
