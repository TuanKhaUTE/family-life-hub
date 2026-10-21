import type { FamilyProfile } from './auth-api'
import { ProfileAvatar } from './ProfileSelector'
import { BreakfastSection } from '../breakfast/BreakfastSection'
import { NotificationPanel } from '../notifications/NotificationPanel'
import { MealRequestSection } from '../meals/MealRequestSection'

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
  return (
    <section className="home-shell" aria-labelledby="home-title">
      <header className="home-header">
        <a className="wordmark" href="#top" aria-label="Trang chủ Family Life Hub">
          <span className="wordmark-icon" aria-hidden="true">
            ⌂
          </span>
          <span>Family Life Hub</span>
        </a>
        <button
          className="logout-button"
          type="button"
          disabled={isLoggingOut}
          onClick={onLogout}
        >
          {isLoggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
        </button>
      </header>

      <div className="home-welcome">
        <ProfileAvatar profile={profile} />
        <div>
          <p className="eyebrow">Không gian của cả nhà</p>
          <h1 id="home-title">Chào {profile.displayName} về nhà</h1>
          <p className="auth-copy">Cả nhà rất vui khi có bạn ở đây.</p>
        </div>
      </div>

      {error && (
        <p className="shell-error" role="alert">
          {error}
        </p>
      )}

      <BreakfastSection profile={profile} />
      <MealRequestSection profile={profile} />
      <NotificationPanel />
    </section>
  )
}
