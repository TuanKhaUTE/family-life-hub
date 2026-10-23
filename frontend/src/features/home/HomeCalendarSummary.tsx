import { ProfileAvatar } from '../auth/ProfileSelector'
import { calendarTime } from '../calendar/calendar-time'
import type { HomeSummary } from './home-api'
import { AppIcon } from '../../ui/AppIcon'

export function HomeCalendarSummary({
  calendar,
  personal = false,
  onOpen,
}: {
  calendar: HomeSummary['calendar']
  personal?: boolean
  onOpen: () => void
}) {
  return (
    <section
      className="home-card home-calendar"
      aria-labelledby={
        personal ? 'home-personal-calendar-title' : 'home-calendar-title'
      }
    >
      <div className="home-section-title">
        <span className="home-section-icon" aria-hidden="true">
          <AppIcon name="calendar" size={20} />
        </span>
        <h2
          id={personal ? 'home-personal-calendar-title' : 'home-calendar-title'}
        >
          {personal ? 'Lịch của tôi hôm nay' : 'Lịch nhà hôm nay'}
        </h2>
        <button className="home-link" onClick={onOpen}>
          Xem lịch
        </button>
      </div>
      {calendar.events.length ? (
        <ul className="home-calendar-list">
          {calendar.events.slice(0, 2).map((item) => (
            <li key={item.id}>
              <ProfileAvatar profile={item.owner} />
              <div>
                <p className="home-meta">
                  {item.owner.displayName} · {calendarTime(item.startsAt)}–
                  {calendarTime(item.endsAt)}
                </p>
                <h3>{item.title}</h3>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="home-meta">
          Hôm nay chưa có lịch sắp tới. Một chút thời gian cho nhà mình nhé.
        </p>
      )}
    </section>
  )
}
