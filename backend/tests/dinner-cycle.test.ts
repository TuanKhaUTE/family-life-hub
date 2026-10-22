import { describe, expect, it } from 'vitest'
import { dinnerTiming } from '../src/time/dinner-cycle.js'
describe('recurring dinner family-time window', () => {
  it.each([
    ['2026-10-22T10:59:59Z', '2026-10-22', false],
    ['2026-10-22T11:00:00Z', '2026-10-23', true],
    ['2026-10-22T17:59:59Z', '2026-10-23', true],
    ['2026-10-22T18:00:00Z', '2026-10-23', false],
  ])('%s selects %s with open=%s', (instant, date, open) => {
    const cycle=dinnerTiming(new Date(instant))
    expect(cycle.date).toBe(date)
    expect(cycle.isOpen).toBe(open)
    if(date==='2026-10-23') { expect(cycle.opensAt.toISOString()).toBe('2026-10-22T11:00:00.000Z'); expect(cycle.deadlineAt.toISOString()).toBe('2026-10-22T18:00:00.000Z') }
  })
})
