export function wellnessNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(
    value,
  )
}
export function wellnessChange(value: number) {
  return `${value > 0 ? '+' : ''}${wellnessNumber(value)} kg`
}
export function wellnessDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value + 'T12:00:00Z'))
}
