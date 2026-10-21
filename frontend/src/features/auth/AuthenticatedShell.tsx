import type { FamilyProfile } from './auth-api'
import { useState } from 'react'
import { ProfileAvatar } from './ProfileSelector'
import { BreakfastSection } from '../breakfast/BreakfastSection'
import { NotificationPanel } from '../notifications/NotificationPanel'
import { MealRequestSection } from '../meals/MealRequestSection'
import { HomePage, type HomeDestination } from '../home/HomePage'
import { StudyPracticePlaceholder } from '../home/StudyPracticePlaceholder'
import { CalendarPage } from '../calendar/CalendarPage'
import './shell.css'

interface AuthenticatedShellProps {
  profile: FamilyProfile
  isLoggingOut: boolean
  error: string | null
  onLogout: () => void
}

export function AuthenticatedShell({
  profile,
  isLoggingOut,
  error,
  onLogout,
}: AuthenticatedShellProps) {
  const [destination, setDestination] = useState<HomeDestination>('Trang chủ')
  const destinations = [
    ['Trang chủ', '⌂'],
    ['Bếp', '🍲'],
    ['Lịch', '📅'],
    profile.role === 'PARENT'
      ? (['Chi tiêu', '💰'] as const)
      : (['Học & Luyện', '🌿'] as const),
    ['Cá nhân', '👤'],
  ] as const
  return (
    <section className="home-shell" aria-label="Không gian gia đình">
      <header className="home-header">
        <a
          className="wordmark"
          href="#top"
          aria-label="Trang chủ Family Life Hub"
        >
          <span className="wordmark-icon" aria-hidden="true">
            ⌂
          </span>
          <span>Family Life Hub</span>
        </a>
        <div className="header-actions">
          <NotificationPanel />
          <button
            className="logout-button"
            type="button"
            disabled={isLoggingOut}
            onClick={onLogout}
          >
            {isLoggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </div>
      </header>

      {error && (
        <p className="shell-error" role="alert">
          {error}
        </p>
      )}

      <main className="shell-content" key={destination}>
        {destination === 'Trang chủ' && (
          <HomePage profile={profile} onNavigate={setDestination} />
        )}
        {destination === 'Học & Luyện' && profile.role !== 'PARENT' && (
          <StudyPracticePlaceholder />
        )}
        {destination === 'Bếp' && (
          <>
            <h1>Bếp nhà mình</h1>
            <BreakfastSection profile={profile} />
            <MealRequestSection profile={profile} />
          </>
        )}
        {destination === 'Lịch' && <CalendarPage profile={profile} />}
        {destination === 'Chi tiêu' && (
          <section className="shell-placeholder">
            <span aria-hidden="true">🌱</span>
            <h1>Góc chi tiêu</h1>
            <p>Một góc nhỏ để chăm chút chuyện chi tiêu, sẽ có sau nhé.</p>
          </section>
        )}
        {destination === 'Cá nhân' && (
          <section className="shell-placeholder">
            <ProfileAvatar profile={profile} />
            <h1>Góc của bạn</h1>
            <p>
              {profile.displayName}, đây là không gian dành riêng cho bạn. Những
              tiện ích cá nhân sẽ được thêm sau.
            </p>
          </section>
        )}
      </main>
      <nav className="bottom-nav" aria-label="Điều hướng chính">
        {destinations.map(([label, icon]) => (
          <button
            type="button"
            key={label}
            aria-current={destination === label ? 'page' : undefined}
            onClick={() => setDestination(label)}
          >
            <span aria-hidden="true">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </section>
  )
}
