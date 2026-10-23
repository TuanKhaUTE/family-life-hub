import type { ReactNode } from 'react'
import { AppIcon, type AppIconName } from './AppIcon'

export function DashboardTile({
  title,
  icon,
  children,
  onOpen,
  openLabel = 'Xem thêm',
  className = '',
  ariaLabel,
}: {
  title: string
  icon: AppIconName
  children?: ReactNode
  onOpen?: () => void
  openLabel?: string
  className?: string
  ariaLabel?: string
}) {
  return (
    <section className={`home-card dashboard-tile ${className}`} aria-label={ariaLabel ?? title}>
      <header className="dashboard-tile-heading">
        <span className="dashboard-tile-icon" aria-hidden="true">
          <AppIcon name={icon} size={20} />
        </span>
        <h2>{title}</h2>
      </header>
      {children && <div className="dashboard-tile-content">{children}</div>}
      {onOpen && (
        <button type="button" className="home-link" onClick={onOpen}>
          {openLabel}
        </button>
      )}
    </section>
  )
}
