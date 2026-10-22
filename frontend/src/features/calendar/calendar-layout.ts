import type { CalendarOccurrence } from './calendar-api'
import { localInputToUtc } from '../meals/family-time'

export const HOUR_HEIGHT = 56
const MIN_BLOCK_HEIGHT = 64
export function calendarLayout(items: CalendarOccurrence[], day: string) {
  const start = Date.parse(localInputToUtc(`${day}T00:00`)!)
  const events = items
    .filter(
      (item) =>
        Date.parse(item.startsAt) < start + 86400000 &&
        Date.parse(item.endsAt) > start,
    )
    .map((item) => ({
      item,
      top: Math.max(
        0,
        ((Date.parse(item.startsAt) - start) / 3600000) * HOUR_HEIGHT,
      ),
      bottom: Math.min(
        24 * HOUR_HEIGHT,
        ((Date.parse(item.endsAt) - start) / 3600000) * HOUR_HEIGHT,
      ),
      lane: 0,
      lanes: 1,
    }))
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom)
  let group: typeof events = []
  let end = -1
  const finish = () => {
    const count = Math.max(1, ...group.map((e) => e.lane + 1))
    group.forEach((e) => {
      e.lanes = count
    })
  }
  for (const event of events) {
    if (event.top >= end) {
      finish()
      group = []
      end = -1
    }
    // Minimum touch height participates in collision placement as well.
    event.bottom = Math.max(event.bottom, event.top + MIN_BLOCK_HEIGHT)
    const occupied = new Set(
      group.filter((e) => e.bottom > event.top).map((e) => e.lane),
    )
    while (occupied.has(event.lane)) event.lane++
    group.push(event)
    end = Math.max(end, event.bottom)
  }
  finish()
  return events
}
