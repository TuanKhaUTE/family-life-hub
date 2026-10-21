import { describe, expect, it } from 'vitest'
import {
  defaultDinnerDeadline,
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
describe('daily dinner deadline', () => {
  it('uses family local time, never a tomorrow deadline hidden in a time input', () => {
    expect(defaultDinnerDeadline(new Date('2026-10-22T01:00:00Z'))).toBe(
      '11:00',
    )
    expect(defaultDinnerDeadline(new Date('2026-10-22T15:00:00Z'))).toBe(
      '23:59',
    )
    expect(localInputToUtc('2026-10-22T23:59')).toBe('2026-10-22T16:59:00.000Z')
  })
})
