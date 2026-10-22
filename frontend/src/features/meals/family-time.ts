export const FAMILY_TIME_ZONE = 'Asia/Ho_Chi_Minh'
export function familyDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FAMILY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
export function defaultDinnerDeadline(now = new Date()) {
  void now
  return '14:00'
}
export function toLocalDateTimeInput(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FAMILY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)!.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}
export function localInputToUtc(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const [, year, month, day, hour, minute] = match
  const target = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  )
  let candidate = target
  for (let i = 0; i < 3; i++) {
    const local = toLocalDateTimeInput(new Date(candidate)),
      represented = Date.parse(local + 'Z'),
      correction = target - represented
    candidate += correction
    if (correction === 0) break
  }
  const date = new Date(candidate)
  if (toLocalDateTimeInput(date) !== value) return null
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
export function relevantBreakfastDate(now = new Date()) {
  const local = toLocalDateTimeInput(now),
    date = new Date(`${local.slice(0, 10)}T12:00:00Z`)
  if (Number(local.slice(11, 13)) >= 18) date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}
export function breakfastLifecycle(date: string, now = new Date()) {
  const previous = new Date(`${date}T12:00:00Z`)
  previous.setUTCDate(previous.getUTCDate() - 1)
  const opensAt = localInputToUtc(
      `${previous.toISOString().slice(0, 10)}T18:00`,
    )!,
    deadlineAt = localInputToUtc(`${date}T01:00`)!
  const phase =
    now.getTime() < Date.parse(opensAt)
      ? 'UPCOMING'
      : now.getTime() < Date.parse(deadlineAt)
        ? 'OPEN'
        : 'CLOSED'
  return { opensAt, deadlineAt, phase, isOpen: phase === 'OPEN' } as const
}
