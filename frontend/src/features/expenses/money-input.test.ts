import { describe, expect, it } from 'vitest'
import {
  isValidMoneyInput,
  normalizeMoneyInput,
  sanitizeMoneyInput,
} from './money-input'

describe('money input', () => {
  it.each(['85000', '85 000', '85,000', '85.000'])('keeps %s as 85000', (value) => {
    expect(sanitizeMoneyInput(value)).toBe('85000')
    expect(normalizeMoneyInput(value)).toBe('85000')
  })

  it('removes all non-ASCII digits', () => {
    expect(sanitizeMoneyInput('8a5\u00a0000đ')).toBe('85000')
  })

  it.each(['', '0', '000', '1000000001'])('rejects %s', (value) => {
    expect(isValidMoneyInput(value)).toBe(false)
  })

  it('accepts the inclusive VND boundaries', () => {
    expect(isValidMoneyInput('1')).toBe(true)
    expect(isValidMoneyInput('1.000.000.000')).toBe(true)
  })
})
