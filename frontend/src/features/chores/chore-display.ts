import type { ChoreInput } from './chore-api'
export const CHORE_LABELS = {
  DISHES: 'Rửa bát',
  TRASH: 'Đổ rác',
  CLEANING: 'Dọn dẹp',
  SHOPPING: 'Đi chợ',
  LAUNDRY: 'Giặt giũ',
  OTHER: 'Việc khác',
}
export const CHORE_ICONS = {
  DISHES: '🫧',
  TRASH: '🧺',
  CLEANING: '🧹',
  SHOPPING: '🛒',
  LAUNDRY: '👕',
  OTHER: '🏡',
}
export function choreTime(
  chore: Pick<ChoreInput, 'category' | 'scheduledTime'>,
) {
  return (
    chore.scheduledTime ??
    (chore.category === 'DISHES' ? 'Sau bữa tối' : 'Trong ngày')
  )
}
