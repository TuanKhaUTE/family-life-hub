import type { StudySummary } from './study-api'
export function studyDuration(minutes: number) {
  const h = Math.floor(minutes / 60),
    m = minutes % 60
  return h ? `${h} giờ${m ? ` ${m} phút` : ''}` : `${m} phút`
}
export function StudyProgress({
  summary,
  compact = false,
}: {
  summary: Omit<StudySummary, 'courses'>
  compact?: boolean
}) {
  const goals = compact ? summary.goals.slice(0, 3) : summary.goals
  return (
    <div className="study-progress">
      <p className="study-total">{studyDuration(summary.totalMinutes)}</p>
      <p>{summary.sessionCount} buổi học trong tuần</p>
      {summary.sessionCount === 0 && (
        <p className="study-muted">Chưa có buổi học nào trong tuần này</p>
      )}
      <h3>Mục tiêu tuần</h3>
      {goals.length ? (
        <ul>
          {goals.map((g) => (
            <li key={g.id}>
              <strong>{g.title}</strong>
              {g.targetMinutes !== null ? (
                <>
                  <p>
                    {studyDuration(g.minutes)} /{' '}
                    {studyDuration(g.targetMinutes)}
                  </p>
                  <progress
                    aria-label={`Tiến độ ${g.title}`}
                    max={g.targetMinutes}
                    value={Math.min(g.minutes, g.targetMinutes)}
                  />
                </>
              ) : (
                <p className="study-muted">Từng bước một, theo nhịp của bạn.</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="study-muted">Bạn chưa có mục tiêu đang thực hiện.</p>
      )}
    </div>
  )
}
