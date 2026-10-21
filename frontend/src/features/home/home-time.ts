import { FAMILY_TIME_ZONE } from '../meals/family-time'

export function greeting(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: FAMILY_TIME_ZONE,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now),
  )
  return hour >= 5 && hour < 12
    ? 'Chào buổi sáng'
    : hour >= 12 && hour < 18
      ? 'Chào buổi chiều'
      : 'Chào buổi tối'
}
