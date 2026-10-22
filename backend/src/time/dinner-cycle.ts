import { getBreakfastTiming, getNextBreakfastDate } from './family-calendar.js'
export function dinnerTiming(now: Date) { return getBreakfastTiming(getNextBreakfastDate(now), now) }
