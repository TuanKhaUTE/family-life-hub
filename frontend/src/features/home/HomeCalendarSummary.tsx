import { ProfileAvatar } from '../auth/ProfileSelector'
import { calendarTime } from '../calendar/calendar-time'
import type { HomeSummary } from './home-api'

export function HomeCalendarSummary({
  calendar,
  parent,
  onOpen,
}: {
  calendar: HomeSummary['calendar']
  parent: boolean
  onOpen: () => void
}) {
  return (
    <section
      className="home-card home-calendar"
      aria-labelledby="home-calendar-title"
    >
      <div className="home-section-title">
        <h2 id="home-calendar-title">
          {parent ? 'Lịch gia đình hôm nay' : 'Lịch của bạn hôm nay'}
        </h2>
        <button className="home-link" onClick={onOpen}>
          Xem lịch
        </button>
      </div>
      {calendar.events.length ? (
        <ul className="home-calendar-list">
          {calendar.events.map((item) => (
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
