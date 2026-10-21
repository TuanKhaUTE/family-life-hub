import { describe, expect, it } from 'vitest'
import {
  familyDate,
  localInputToUtc,
  toLocalDateTimeInput,
} from './family-time'
describe('family meal time', () => {
  it('uses the Vietnam family date boundary', () => {
    expect(familyDate(new Date('2026-10-21T16:59:59Z'))).toBe('2026-10-21')
    expect(familyDate(new Date('2026-10-21T17:00:00Z'))).toBe('2026-10-22')
  })
  it('converts a family local deadline to UTC', () => {
    expect(localInputToUtc('2026-10-21T12:00')).toBe('2026-10-21T05:00:00.000Z')
  })
  it('formats a UTC instant for a datetime-local control', () => {
    expect(toLocalDateTimeInput(new Date('2026-10-21T05:00:00Z'))).toBe(
      '2026-10-21T12:00',
    )
  })
})
