export const FAMILY_TIME_ZONE = 'Asia/Ho_Chi_Minh'

export interface BreakfastTiming {
  date: string
  deadlineAt: Date
  isOpen: boolean
}

interface CalendarParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const zonedFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: FAMILY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

export function isBreakfastDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const candidate = new Date(Date.UTC(year!, month! - 1, day!))

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month! - 1 &&
    candidate.getUTCDate() === day
  )
}

export const isFamilyDate = isBreakfastDate

export function getFamilyDate(now: Date): string {
  const local = getZonedParts(now)
  return formatDate(local.year, local.month, local.day)
}

export function getNextBreakfastDate(now: Date): string {
  const local = getZonedParts(now)
  const next = new Date(Date.UTC(local.year, local.month - 1, local.day + 1))

  return formatDate(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
  )
}

export function getBreakfastTiming(
  date: string,
  now: Date,
): BreakfastTiming {
  if (!isBreakfastDate(date)) {
    throw new RangeError('Invalid breakfast date')
  }

  const deadlineAt = localMidnightToUtc(date)

  return {
    date,
    deadlineAt,
    isOpen:
      date === getNextBreakfastDate(now) && now.getTime() < deadlineAt.getTime(),
  }
}

function localMidnightToUtc(date: string): Date {
  const [year, month, day] = date.split('-').map(Number) as [
    number,
    number,
    number,
  ]
  const targetAsUtc = Date.UTC(year, month - 1, day)
  let candidate = targetAsUtc

  // Iterating the timezone offset keeps all family-day logic in one place and
  // remains correct if the configured IANA zone later gains offset changes.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const local = getZonedParts(new Date(candidate))
    const representedAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    )
    const correction = targetAsUtc - representedAsUtc

    candidate += correction
    if (correction === 0) break
  }

  return new Date(candidate)
}

function getZonedParts(date: Date): CalendarParts {
  const values = new Map(
    zonedFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  )

  return {
    year: values.get('year')!,
    month: values.get('month')!,
    day: values.get('day')!,
    hour: values.get('hour')!,
    minute: values.get('minute')!,
    second: values.get('second')!,
  }
}

function formatDate(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, '0')}-${month
    .toString()
    .padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}
