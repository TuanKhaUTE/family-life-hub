import { describe, expect, it } from 'vitest'

import {
  FAMILY_TIME_ZONE,
  getFamilyDate,
  getBreakfastTiming,
  getNextBreakfastDate,
  isBreakfastDate,
} from '../src/time/family-calendar.js'

describe('family breakfast calendar', () => {
  it('uses the configured Vietnam family timezone', () => {
    expect(FAMILY_TIME_ZONE).toBe('Asia/Ho_Chi_Minh')
  })

  it('returns the current family date across the UTC boundary', () => {
    expect(getFamilyDate(new Date('2026-10-21T16:59:59.000Z'))).toBe(
      '2026-10-21',
    )
    expect(getFamilyDate(new Date('2026-10-21T17:00:00.000Z'))).toBe(
      '2026-10-22',
    )
  })

  it('returns the next local date and its UTC midnight deadline', () => {
    const now = new Date('2026-10-21T16:59:59.000Z')

    expect(getNextBreakfastDate(now)).toBe('2026-10-22')
    expect(getBreakfastTiming('2026-10-22', now)).toEqual({
      date: '2026-10-22',
      deadlineAt: new Date('2026-10-21T17:00:00.000Z'),
      isOpen: true,
    })
  })

  it('moves to the following breakfast exactly at local midnight', () => {
    const now = new Date('2026-10-21T17:00:00.000Z')

    expect(getNextBreakfastDate(now)).toBe('2026-10-23')
    expect(getBreakfastTiming('2026-10-22', now).isOpen).toBe(false)
    expect(getBreakfastTiming('2026-10-23', now)).toEqual({
      date: '2026-10-23',
      deadlineAt: new Date('2026-10-22T17:00:00.000Z'),
      isOpen: true,
    })
  })

  it.each([
    ['2028-02-29', true],
    ['2026-02-29', false],
    ['2026-2-09', false],
    ['2026-13-01', false],
    ['not-a-date', false],
  ])('validates strict date-only value %s', (value, expected) => {
    expect(isBreakfastDate(value)).toBe(expected)
  })

  it('keeps non-next requested dates read-only even before their deadline', () => {
    const now = new Date('2026-10-21T08:00:00.000Z')

    expect(getBreakfastTiming('2026-10-23', now).isOpen).toBe(false)
  })
})
