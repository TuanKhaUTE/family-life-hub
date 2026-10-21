import { describe, expect, it } from 'vitest'

import {
  generateSessionToken,
  hashSessionToken,
  isSessionToken,
} from '../src/security/session-token.js'

describe('session token security', () => {
  it('generates distinct base64url tokens containing 32 random bytes', () => {
    const first = generateSessionToken()
    const second = generateSessionToken()

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(Buffer.from(first, 'base64url')).toHaveLength(32)
    expect(second).not.toBe(first)
  })

  it('hashes tokens to a deterministic lowercase SHA-256 digest', () => {
    expect(hashSessionToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('accepts only the exact generated token shape', () => {
    expect(isSessionToken(generateSessionToken())).toBe(true)

    for (const value of [
      '',
      'a'.repeat(42),
      'a'.repeat(44),
      'a'.repeat(42) + '%',
    ]) {
      expect(isSessionToken(value)).toBe(false)
    }
  })
})
