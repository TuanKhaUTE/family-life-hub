import type { ReactNode } from 'react'
import { AppIcon } from './AppIcon'

export function MealTile({
  kind,
  title,
  date,
  status,
  children,
  actionLabel,
  onOpen,
  className = '',
}: {
  kind: 'breakfast' | 'dinner'
  title: string
  date?: string
  status?: string
  children?: ReactNode
  actionLabel: string
  onOpen: () => void
  className?: string
}) {
  return (
    <article className={`home-card home-meal-tile home-${kind} ${className}`}>
      <div className="home-meal-tile-heading">
        <span className="home-card-icon" aria-hidden="true">
          <AppIcon name={kind} size={24} />
        </span>
        <div>
          <h3>{title}</h3>
          {date && <p className="home-date">{date}</p>}
        </div>
      </div>
      {status && <p className="home-meal-state">{status}</p>}
      {children}
      <button type="button" className="home-link" onClick={onOpen}>
        {actionLabel}
      </button>
    </article>
  )
}
