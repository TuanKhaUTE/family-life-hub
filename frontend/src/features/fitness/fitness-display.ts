import type { FitnessRecord } from './fitness-api'
export const FITNESS_WEEKDAYS = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ nhật',
]
export function fitnessDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value + 'T12:00:00Z'))
}
export function fitnessDuration(value: number) {
  const h = Math.floor(value / 60),
    m = value % 60
  return h ? `${h} giờ${m ? ` ${m} phút` : ''}` : `${m} phút`
}
export function fitnessRecordName(row: FitnessRecord) {
  return 'name' in row ? row.name : 'title' in row ? row.title : 'Mục tiêu tuần'
}
