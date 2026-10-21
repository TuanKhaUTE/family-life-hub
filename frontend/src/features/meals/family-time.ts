export const FAMILY_TIME_ZONE = 'Asia/Ho_Chi_Minh'
export function familyDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FAMILY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
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
  const candidate = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) - 7,
    Number(minute),
  )
  const date = new Date(candidate)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
