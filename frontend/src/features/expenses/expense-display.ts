import type { ExpenseCategory, ExpenseHomeSummary } from './expense-api'
export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  FOOD: 'Ăn uống',
  TRANSPORT: 'Di chuyển',
  SHOPPING: 'Mua sắm',
  ENTERTAINMENT: 'Giải trí',
  STUDY: 'Học tập',
  FITNESS: 'Rèn luyện',
  BILLS: 'Hóa đơn',
  OTHER: 'Khác',
}
export function formatVnd(value: string) {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(BigInt(value))} đ`
}
export function expenseMonthLabel(value: string) {
  return `Tháng ${Number(value.slice(5))}/${value.slice(0, 4)}`
}
export function expenseDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(new Date(value + 'T12:00:00Z'))
}
export function expenseComparisonText(
  summary: Pick<
    ExpenseHomeSummary,
    'previousTotal' | 'differenceAmount' | 'percentageChange'
  >,
) {
  if (summary.previousTotal === '0')
    return 'Tháng trước chưa ghi khoản chi, chưa tính tỷ lệ.'
  const diff = BigInt(summary.differenceAmount)
  if (diff === 0n) return 'Bằng tháng trước'
  return `${diff > 0n ? 'Tăng' : 'Giảm'} ${formatVnd((diff < 0n ? -diff : diff).toString())}${summary.percentageChange === null ? '' : ` · ${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(Math.abs(summary.percentageChange))}%`}`
}
