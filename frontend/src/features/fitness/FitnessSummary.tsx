import type { FitnessHomeSummary } from './fitness-api'
import { fitnessDuration } from './fitness-display'
export function FitnessSummary({
  summary,
  compact = false,
}: {
  summary: FitnessHomeSummary
  compact?: boolean
}) {
  const known = summary.sessionsThisWeek - summary.unrecordedDurationCount
  return (
    <div className="fitness-progress">
      <p className="fitness-total">
        {summary.sessionsThisWeek}
        {summary.weeklyTarget !== null ? ` / ${summary.weeklyTarget}` : ''} buổi
        {summary.weeklyTarget !== null ? ' hoàn thành' : ' đã tập'}
      </p>
      {summary.weeklyTarget !== null && (
        <>
          <progress
            aria-label="Tiến độ rèn luyện tuần này"
            max={summary.weeklyTarget}
            value={Math.min(summary.sessionsThisWeek, summary.weeklyTarget)}
          />
          <p>
            {summary.completionPercent}%
            {summary.completionPercent === 100
              ? ' · Bạn đã đạt mục tiêu tuần này 💚'
              : ''}
          </p>
        </>
      )}
      {summary.sessionsThisWeek === 0 && (
        <p className="fitness-muted">Chưa có buổi tập nào trong tuần này</p>
      )}
      {!compact && <h3>Tổng thời gian đã ghi</h3>}
      <p>
        {known > 0 || summary.sessionsThisWeek === 0
          ? fitnessDuration(summary.totalMinutes)
          : 'Chưa ghi thời lượng'}
      </p>
      {summary.unrecordedDurationCount > 0 && (
        <p className="fitness-muted">
          {summary.unrecordedDurationCount} buổi chưa ghi thời lượng
        </p>
      )}
      {summary.weeklyTarget === null && (
        <p className="fitness-muted">Bạn chưa đặt mục tiêu tuần.</p>
      )}
    </div>
  )
}
