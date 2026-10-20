import argon2 from 'argon2'

const SIX_ASCII_DIGITS = /^\d{6}$/

export class PinValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PinValidationError'
  }
}

export function validatePin(pin: string, confirmation: string): void {
  if (!SIX_ASCII_DIGITS.test(pin)) {
    throw new PinValidationError('PIN must contain exactly six digits')
  }

  if (pin !== confirmation) {
    throw new PinValidationError('PIN confirmation does not match')
  }
}

export async function hashPin(pin: string): Promise<string> {
  validatePin(pin, pin)

  return argon2.hash(pin, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    hashLength: 32,
  })
}
