import { describe, expect, it } from 'vitest'

import {
  hashPin,
  PinValidationError,
  validatePin,
  verifyPin,
} from '../src/security/pin.js'

const syntheticPin = '123456'

describe('validatePin', () => {
  it('accepts matching six-digit ASCII PINs', () => {
    expect(() => validatePin(syntheticPin, syntheticPin)).not.toThrow()
  })

  it.each([
    { pin: '', confirmation: '', label: 'an empty PIN' },
    { pin: '12345', confirmation: '12345', label: 'a short PIN' },
    { pin: '1234567', confirmation: '1234567', label: 'a long PIN' },
    { pin: '12345a', confirmation: '12345a', label: 'a PIN containing a letter' },
    { pin: '１２３４５６', confirmation: '１２３４５６', label: 'non-ASCII digits' },
    { pin: syntheticPin, confirmation: '654321', label: 'a mismatched confirmation' },
  ])('rejects $label', ({ pin, confirmation }) => {
    expect(() => validatePin(pin, confirmation)).toThrow(PinValidationError)
  })
})

describe('hashPin', () => {
  it('creates a verifiable Argon2id PHC hash with the approved parameters', async () => {
    const { verify } = await import('argon2')

    const hash = await hashPin(syntheticPin)

    expect(hash).toMatch(/^\$argon2id\$/)
    expect(hash).toMatch(/\$m=19456,p=1,t=2\$/)
    await expect(verify(hash, syntheticPin)).resolves.toBe(true)
    await expect(verify(hash, '654321')).resolves.toBe(false)
  })

  it('uses a new random salt for each hash', async () => {
    const firstHash = await hashPin(syntheticPin)
    const secondHash = await hashPin(syntheticPin)

    expect(firstHash).not.toBe(secondHash)
  })
})

describe('verifyPin', () => {
  it('accepts the matching PIN and rejects a different valid PIN', async () => {
    const hash = await hashPin(syntheticPin)

    await expect(verifyPin(syntheticPin, hash)).resolves.toBe(true)
    await expect(verifyPin('654321', hash)).resolves.toBe(false)
  })
})
