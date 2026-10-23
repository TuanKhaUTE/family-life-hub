export type AppIconName =
  | 'home'
  | 'kitchen'
  | 'calendar'
  | 'study'
  | 'fitness'
  | 'personal'
  | 'expense'
  | 'notification'
  | 'breakfast'
  | 'dinner'
  | 'chores'
  | 'rating'

const paths: Record<AppIconName, ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9.5V21h14V9.5M9 21v-6h6v6" />
    </>
  ),
  kitchen: (
    <>
      <path d="M5 3v7a3 3 0 0 0 6 0V3M8 3v18M5 7h6" />
      <path d="M16 3v18M16 3c3 2 3 6 0 8h4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M7 3v4M17 3v4M3 10h18M7 14h.01M12 14h.01M17 14h.01M7 18h.01M12 18h.01" />
    </>
  ),
  study: (
    <>
      <path d="m3 7 9-4 9 4-9 4-9-4Z" />
      <path d="M6 9v6c3 2 9 2 12 0V9M21 8v7" />
    </>
  ),
  fitness: (
    <>
      <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10M2 12h2M20 12h2" />
    </>
  ),
  personal: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c.8-4 3.4-6 8-6s7.2 2 8 6" />
    </>
  ),
  expense: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M3 9h18M7 15h4" />
    </>
  ),
  notification: (
    <>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
    </>
  ),
  breakfast: (
    <>
      <path d="M4 15h16M6 15a6 6 0 0 1 12 0M12 3v2M4.9 6.1l1.4 1.4M19.1 6.1l-1.4 1.4" />
      <path d="M5 18h14v2H5z" />
    </>
  ),
  dinner: (
    <>
      <path d="M4 14h16a8 8 0 0 1-16 0ZM3 14h18M12 4v3M8 5l1 2M16 5l-1 2" />
    </>
  ),
  chores: (
    <>
      <path d="M5 20h14M7 20v-6h10v6M8 14V7h8v7M10 7V4h4v3" />
      <path d="m9 10 1.5 1.5L14 8" />
    </>
  ),
  rating: (
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
  ),
}

export function AppIcon({
  name,
  size = 22,
  className,
  label,
}: {
  name: AppIconName
  size?: number
  className?: string
  label?: string
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
    >
      {paths[name]}
    </svg>
  )
}
import type { ReactNode } from 'react'

