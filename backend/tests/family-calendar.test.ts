import { describe, expect, it } from 'vitest'

import {
  FAMILY_TIME_ZONE,
  getFamilyDate,
  getBreakfastTiming,
  getNextBreakfastDate,
  isBreakfastDate,
} from '../src/time/family-calendar.js'

describe('family breakfast calendar', () => {
  it.each([
    ['2026-10-22T10:59:59.999Z', false, '2026-10-22'],
    ['2026-10-22T11:00:00.000Z', true, '2026-10-23'],
    ['2026-10-22T17:00:00.000Z', true, '2026-10-23'],
    ['2026-10-22T17:59:59.999Z', true, '2026-10-23'],
    ['2026-10-22T18:00:00.000Z', false, '2026-10-23'],
    ['2026-10-23T11:00:00.000Z', false, '2026-10-24'],
  ])(
    'uses exact 18:00/01:00 family boundaries at %s',
    (instant, open, active) => {
      const now = new Date(instant)
      expect(getBreakfastTiming('2026-10-23', now).isOpen).toBe(open)
      expect(
        getBreakfastTiming('2026-10-23', now).deadlineAt.toISOString(),
      ).toBe('2026-10-22T18:00:00.000Z')
      expect(getNextBreakfastDate(now)).toBe(active)
    },
  )
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

  it('returns the evening cycle and its UTC 01:00 deadline', () => {
    const now = new Date('2026-10-21T16:59:59.000Z')

    expect(getNextBreakfastDate(now)).toBe('2026-10-22')
    expect(getBreakfastTiming('2026-10-22', now)).toEqual({
      date: '2026-10-22',
      opensAt: new Date('2026-10-21T11:00:00.000Z'),
      deadlineAt: new Date('2026-10-21T18:00:00.000Z'),
      isOpen: true,
    })
  })

  it('keeps the same breakfast across midnight, not the following day', () => {
    const now = new Date('2026-10-21T17:00:00.000Z')

    expect(getNextBreakfastDate(now)).toBe('2026-10-22')
    expect(getBreakfastTiming('2026-10-22', now).isOpen).toBe(true)
    expect(getBreakfastTiming('2026-10-23', now)).toEqual({
      date: '2026-10-23',
      opensAt: new Date('2026-10-22T11:00:00.000Z'),
      deadlineAt: new Date('2026-10-22T18:00:00.000Z'),
      isOpen: false,
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
