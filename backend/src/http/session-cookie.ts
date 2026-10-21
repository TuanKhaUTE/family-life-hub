import type { CookieOptions } from 'express'

export const SESSION_COOKIE_NAME = 'family_session'
export const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000

export function parseSessionCookie(header: string | undefined): string | null {
  if (!header) {
    return null
  }

  for (const cookie of header.split(';')) {
    const separatorIndex = cookie.indexOf('=')

    if (separatorIndex < 1) {
      continue
    }

    const name = cookie.slice(0, separatorIndex).trim()
    const value = cookie.slice(separatorIndex + 1).trim()

    if (name === SESSION_COOKIE_NAME) {
      return value || null
    }
  }

  return null
}

export function getSessionCookieOptions(
  expiresAt: Date,
  secure = process.env.NODE_ENV === 'production',
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    expires: expiresAt,
  }
}

export function getSessionCookieClearOptions(
  secure = process.env.NODE_ENV === 'production',
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
  }
}
