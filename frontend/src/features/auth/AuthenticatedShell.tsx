import type { FamilyProfile } from './auth-api'
import { useState } from 'react'
import { BreakfastSection } from '../breakfast/BreakfastSection'
import { NotificationPanel } from '../notifications/NotificationPanel'
import { MealRequestSection } from '../meals/MealRequestSection'
import { HomePage, type HomeDestination } from '../home/HomePage'
import { StudyPage } from '../study/StudyPage'
import { CalendarPage } from '../calendar/CalendarPage'
import { ExpensePage } from '../expenses/ExpensePage'
import { PersonalPage } from '../personal/PersonalPage'
import { MealFoodCost } from '../expenses/MealFoodCost'
import { familyDate } from '../meals/family-time'
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
          <StudyPage profile={profile} />
        )}
        {destination === 'Bếp' && (
          <>
            <h1>Bếp nhà mình</h1>
            <BreakfastSection profile={profile} />
            <MealFoodCost date={familyDate()} mealType="BREAKFAST" />
            <MealRequestSection profile={profile} />
          </>
        )}
        {destination === 'Lịch' && <CalendarPage profile={profile} />}
        {destination === 'Chi tiêu' && profile.role === 'PARENT' && (
          <ExpensePage parent />
        )}
        {destination === 'Tiền ăn gia đình' && (
          <ExpensePage
            parent={profile.role === 'PARENT'}
            initialTab="family"
            onBack={
              profile.role !== 'PARENT'
                ? () => setDestination('Cá nhân')
                : undefined
            }
          />
        )}
        {destination === 'Chi tiêu cá nhân' && profile.role !== 'PARENT' && (
          <ExpensePage
            parent={false}
            onBack={() => setDestination('Cá nhân')}
          />
        )}
        {destination === 'Cá nhân' && (
          <PersonalPage
            profile={profile}
            onExpenses={() =>
              setDestination(
                profile.role === 'PARENT' ? 'Chi tiêu' : 'Chi tiêu cá nhân',
              )
            }
          />
        )}
      </main>
      <nav className="bottom-nav" aria-label="Điều hướng chính">
        {destinations.map(([label, icon]) => (
          <button
            type="button"
            key={label}
            aria-current={
              destination === label ||
              (destination === 'Chi tiêu cá nhân' && label === 'Cá nhân') ||
              (destination === 'Tiền ăn gia đình' &&
                label === (profile.role === 'PARENT' ? 'Chi tiêu' : 'Cá nhân'))
                ? 'page'
                : undefined
            }
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
