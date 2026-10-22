import { describe, expect, it } from 'vitest'
import { calendarLayout } from './calendar-layout'
import type { CalendarOccurrence } from './calendar-api'
function item(id: string, start: string, end: string): CalendarOccurrence {
  return {
    event: {
      id,
      ownerMemberId: 'self',
      title: id,
      category: 'SCHOOL',
      startsAt: start,
      endsAt: end,
      weekdays: null,
      recurrenceUntil: null,
      note: null,
      createdAt: start,
      updatedAt: start,
    },
    owner: {
      id: 'self',
      displayName: 'Synthetic',
      avatarType: null,
      avatarValue: null,
    },
    date: '2099-05-04',
    title: id,
    startsAt: start,
    endsAt: end,
    note: null,
    cancelled: false,
    isException: false,
  }
}
describe('calendar time-axis layout', () => {
  it('gives short family events enough height for title, time and owner', () => {
    const result = calendarLayout(
      [item('short', '2099-05-04T02:00Z', '2099-05-04T02:05Z')],
      '2099-05-04',
    )
    expect(result[0]!.bottom - result[0]!.top).toBeGreaterThanOrEqual(64)
  })
  it('positions blocks by family-local time independently of browser timezone', () => {
    const result = calendarLayout(
      [item('one', '2099-05-04T02:30Z', '2099-05-04T04:00Z')],
      '2099-05-04',
    )
    expect(result[0]!.top).toBe(9.5 * 56)
    expect(result[0]!.bottom).toBe(11 * 56)
  })
  it('gives overlapping blocks distinct lanes without hiding sequential blocks', () => {
    const result = calendarLayout(
      [
        item('one', '2099-05-04T02:00Z', '2099-05-04T04:00Z'),
        item('two', '2099-05-04T03:00Z', '2099-05-04T05:00Z'),
        item('three', '2099-05-04T06:00Z', '2099-05-04T07:00Z'),
      ],
      '2099-05-04',
    )
    expect(result.map((e) => [e.lane, e.lanes])).toEqual([
      [0, 2],
      [1, 2],
      [0, 1],
    ])
  })
  it('clips overnight events on each relevant day and does not display them outside the interval', () => {
    const event = item('overnight', '2099-05-03T16:00Z', '2099-05-04T02:00Z')
    expect(calendarLayout([event], '2099-05-03')[0]!.top).toBe(23 * 56)
    expect(calendarLayout([event], '2099-05-04')[0]!.top).toBe(0)
    expect(calendarLayout([event], '2099-05-04')[0]!.bottom).toBe(9 * 56)
    expect(calendarLayout([event], '2099-05-05')).toEqual([])
  })
  it('keeps short blocks touchable and accounts for their visual collision height', () => {
    const result = calendarLayout(
      [
        item('one', '2099-05-04T02:00Z', '2099-05-04T02:05Z'),
        item('two', '2099-05-04T02:10Z', '2099-05-04T02:15Z'),
      ],
      '2099-05-04',
    )
    expect(result.every((e) => e.bottom - e.top >= 44)).toBe(true)
    expect(result.map((e) => e.lanes)).toEqual([2, 2])
  })
})
