import type { HomeSummary } from './home-api'
import { ProfileAvatar } from '../auth/ProfileSelector'
import { choreTime, CHORE_ICONS } from '../chores/chore-display'
export function HomeChoresSummary({
  chores,
  parent,
  onOpen,
}: {
  chores: HomeSummary['chores']
  parent: boolean
  onOpen: () => void
}) {
  return (
    <section
      className={parent ? 'home-card home-chores' : 'home-own-chores'}
      aria-label={parent ? 'Việc nhà hôm nay' : 'Việc nhà của bạn'}
    >
      <div className="home-section-title">
        {parent ? <h2>Việc nhà hôm nay</h2> : <h3>Việc nhà</h3>}
        <button className="home-link" onClick={onOpen}>
          Xem lịch
        </button>
      </div>
      {chores.length ? (
        <ul className="home-chores-list">
          {chores.map((item, i) => (
            <li key={`${item.scheduleId}:${item.date}:${i}`}>
              <span aria-hidden="true">
                {item.status === 'COMPLETED' ? '✓' : CHORE_ICONS[item.category]}
              </span>
              <div>
                <div className="home-chore-assignee">
                  <ProfileAvatar profile={item.assignee} />
                  <span>{item.assignee.displayName}</span>
                </div>
                <h3>{item.title}</h3>
                <p className="home-meta">
                  {choreTime(item)} ·{' '}
                  {item.status === 'COMPLETED'
                    ? 'Hoàn thành ✓'
                    : 'Chưa hoàn thành'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="home-meta">Hôm nay chưa có việc nhà cần làm.</p>
      )}
    </section>
  )
}
