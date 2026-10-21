import { FAMILY_TIME_ZONE } from '../meals/family-time'
export const CATEGORY_LABELS = {
  SCHOOL: 'Học tập',
  WORK: 'Công việc',
  FITNESS: 'Rèn luyện',
  FAMILY: 'Gia đình',
  APPOINTMENT: 'Cuộc hẹn',
  PERSONAL: 'Cá nhân',
  OTHER: 'Khác',
}
export const CATEGORY_ICONS = {
  SCHOOL: '📖',
  WORK: '💼',
  FITNESS: '🌿',
  FAMILY: '🏡',
  APPOINTMENT: '☕',
  PERSONAL: '☀',
  OTHER: '📌',
}
export const WEEKDAYS = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ nhật',
]
export function shiftDay(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
export function weekRange(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7
  const from = shiftDay(date, 1 - weekday)
  return { from, to: shiftDay(from, 6) }
}
export function calendarDay(date: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: FAMILY_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`))
}
export function calendarTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: FAMILY_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
}
