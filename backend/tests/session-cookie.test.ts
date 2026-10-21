import { describe, expect, it } from 'vitest'

import {
  getSessionCookieClearOptions,
  getSessionCookieOptions,
  parseSessionCookie,
  SESSION_COOKIE_NAME,
} from '../src/http/session-cookie.js'
import { generateSessionToken } from '../src/security/session-token.js'

describe('session cookie parsing', () => {
  it('reads the first exact session cookie without matching similar names', () => {
    const token = generateSessionToken()
    const ignoredToken = generateSessionToken()
    const header = `not_family_session=${ignoredToken}; ${SESSION_COOKIE_NAME}=${token}; ${SESSION_COOKIE_NAME}=${ignoredToken}`

    expect(parseSessionCookie(header)).toBe(token)
  })

  it.each([
    undefined,
    '',
    'family_session',
    'family_session=',
    'family_session%3Dvalue',
  ])(
    'returns null for an absent or malformed cookie header: %s',
    (header) => {
      expect(parseSessionCookie(header)).toBeNull()
    },
  )
})

describe('session cookie options', () => {
  const expiresAt = new Date('2026-10-28T00:00:00.000Z')

  it('sets the fixed safe attributes without a Domain in development', () => {
    expect(getSessionCookieOptions(expiresAt, false)).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: false,
      expires: expiresAt,
    })
  })

  it('enables Secure in production for set and clear operations', () => {
    expect(getSessionCookieOptions(expiresAt, true).secure).toBe(true)
    expect(getSessionCookieClearOptions(true)).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: true,
    })
  })
})
