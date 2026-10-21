import type { FamilyProfile } from './auth-api'
import { ProfileAvatar } from './ProfileSelector'

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
        <a className="wordmark" href="#top" aria-label="Family Life Hub home">
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
          {isLoggingOut ? 'Logging out…' : 'Log out'}
        </button>
      </header>

      <div className="home-welcome">
        <ProfileAvatar profile={profile} />
        <div>
          <p className="eyebrow">Your family space</p>
          <h1 id="home-title">Welcome home, {profile.displayName}</h1>
          <p className="auth-copy">It’s good to have you here.</p>
        </div>
      </div>

      {error && (
        <p className="shell-error" role="alert">
          {error}
        </p>
      )}

      <article className="upcoming-card">
        <span className="upcoming-icon" aria-hidden="true">
          ♥
        </span>
        <div>
          <h2>Your family hub is ready</h2>
          <p>More helpful spaces for daily family life are coming next.</p>
        </div>
      </article>
    </section>
  )
}
