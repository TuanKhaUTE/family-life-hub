import type { HomeSummary } from './home-api'
import { AppIcon } from '../../ui/AppIcon'

export function HomeGamification({
  gamification,
  parent,
}: {
  gamification: NonNullable<HomeSummary['gamification']>
  parent: boolean
}) {
  const personal = gamification.personal
  return (
    <section className="home-card home-gamification" aria-labelledby="home-gamification-title">
      <div className="home-section-title">
        <span className="home-section-icon" aria-hidden="true">
          <AppIcon name="rating" size={19} />
        </span>
        <h2 id="home-gamification-title">Điểm vui tuần này</h2>
      </div>
      <div className="home-gamification-grid">
        {!parent && personal?.study && (
          <p>
            Học tập: {personal.study.completed}/{personal.study.planned} buổi tuần này
            {personal.study.streak > 0 && ` · ${personal.study.streak} buổi liên tiếp`}
          </p>
        )}
        {!parent && personal?.fitness && (
          <p>
            Rèn luyện: {personal.fitness.completed}/{personal.fitness.planned} buổi tuần này
            {personal.fitness.streak > 0 && ` · ${personal.fitness.streak} buổi liên tiếp`}
          </p>
        )}
        {!parent && gamification.breakfastStreak > 0 && (
          <p>🔥 {gamification.breakfastStreak} ngày chọn bữa sáng đúng giờ</p>
        )}
        <p>
          {parent
            ? `Cả nhà đã hoàn thành ${gamification.household.completedRecent} việc nhà gần đây ✓`
            : `${gamification.household.completedRecent} lần hoàn thành việc nhà gần đây ✓`}
        </p>
      </div>
      {gamification.achievements.length ? (
        <ul className="home-achievements">
          {gamification.achievements.map((achievement) => (
            <li key={achievement.key}>{achievement.label}</li>
          ))}
        </ul>
      ) : (
        <p className="home-meta">Mỗi việc nhỏ hôm nay đều đáng ghi nhận.</p>
      )}
    </section>
  )
}
