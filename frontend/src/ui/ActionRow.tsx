import { AppIcon, type AppIconName } from './AppIcon'

export function ActionRow({
  label,
  id,
  onClick,
}: {
  label: string
  id: string
  onClick: () => void
}) {
  const icon: AppIconName = id.includes('breakfast')
    ? 'breakfast'
    : id.includes('dinner')
      ? 'dinner'
      : id.includes('rating')
        ? 'rating'
        : id.includes('chore')
          ? 'chores'
          : 'notification'
  const cta = id.includes('breakfast')
    ? 'Chọn ngay'
    : id.includes('dinner')
      ? 'Trả lời'
      : id.includes('rating')
        ? 'Đánh giá'
        : 'Xem ngay'
  return (
    <li className="home-action-row">
      <button type="button" onClick={onClick}>
        <span className="home-action-icon" aria-hidden="true">
          <AppIcon name={icon} size={20} />
        </span>
        <span className="home-action-copy">
          <strong>{label}</strong>
          <small>{id.includes('breakfast') ? 'Bữa sáng hôm nay' : 'Một việc nhỏ cho hôm nay'}</small>
        </span>
        <span className="home-action-cta">{cta}</span>
      </button>
    </li>
  )
}
