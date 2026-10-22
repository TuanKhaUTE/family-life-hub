import { afterEach, expect, it, vi } from 'vitest'
import {
  fetchSettings,
  saveProfile,
  changePin,
  resetPin,
  resetMembers,
  ProfileApiError,
} from './profile-api'
afterEach(() => vi.unstubAllGlobals())
const profile = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Synthetic Member',
  role: 'MEMBER',
  avatarType: null,
  avatarValue: null,
}
it('settings API whitelists profile/avatar DTOs and sends same-origin no-store requests', async () => {
  const fetch = vi.fn(async () =>
    Response.json({
      settings: {
        profile: { ...profile, pin_hash: 'must-be-omitted' },
        avatarChoices: [
          {
            avatarType: 'EMOJI',
            avatarValue: '🌿',
            label: 'Chiếc lá',
            internal: 'omit',
          },
        ],
      },
    }),
  )
  vi.stubGlobal('fetch', fetch)
  expect(await fetchSettings()).toEqual({
    profile,
    avatarChoices: [
      { avatarType: 'EMOJI', avatarValue: '🌿', label: 'Chiếc lá' },
    ],
  })
  expect(fetch).toHaveBeenCalledWith(
    '/api/profile/me',
    expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }),
  )
})
it('profile save and recovery selector return only safe profiles', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ profile: { ...profile, pin_hash: 'omit' } }),
      )
      .mockResolvedValueOnce(Response.json({ members: [profile] })),
  )
  expect(
    await saveProfile({
      displayName: profile.displayName,
      avatarType: null,
      avatarValue: null,
    }),
  ).toEqual(profile)
  expect(await resetMembers()).toEqual([profile])
})
it('PIN commands use POST/204 without returning credentials', async () => {
  const fetch = vi.fn(
    async (_input: RequestInfo | URL) => new Response(null, { status: 204 }),
  )
  vi.stubGlobal('fetch', fetch)
  const input = {
    currentPin: '123456',
    newPin: '654321',
    confirmation: '654321',
  }
  expect(await changePin(input)).toBeUndefined()
  expect(
    await resetPin(profile.id, { ...input, confirmReset: true }),
  ).toBeUndefined()
  expect(fetch.mock.calls.map((c) => c[0])).toEqual([
    '/api/profile/me/pin',
    '/api/profile/members/' + profile.id + '/pin-reset',
  ])
})
it.each([401, 403, 503])(
  'does not expose upstream %s response details',
  async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ error: 'secret upstream detail' }, { status }),
      ),
    )
    await expect(fetchSettings()).rejects.toBeInstanceOf(ProfileApiError)
    await expect(fetchSettings()).rejects.not.toThrow('secret')
  },
)
it('rejects malformed settings/member payloads', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        settings: { profile, avatarChoices: [{ avatarType: 'URL' }] },
        members: 'bad',
      }),
    ),
  )
  await expect(fetchSettings()).rejects.toThrow()
  await expect(resetMembers()).rejects.toThrow()
})
