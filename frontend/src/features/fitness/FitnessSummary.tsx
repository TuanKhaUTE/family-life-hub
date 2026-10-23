import type { FitnessHomeSummary } from './fitness-api'
import { fitnessDuration } from './fitness-display'
import { AppIcon } from '../../ui/AppIcon'
export function FitnessSummary({
  summary,
  compact = false,
}: {
  summary: FitnessHomeSummary
  compact?: boolean
}) {
  const known = summary.sessionsThisWeek - summary.unrecordedDurationCount
  return (
    <div className={`fitness-progress${compact ? ' fitness-progress-compact' : ''}`}>
      <div className="fitness-summary-metrics">
        <div className="fitness-summary-metric">
          <span className="overview-metric-icon"><AppIcon name="fitness" size={16} /></span>
          <strong className="fitness-total">
            {summary.sessionsThisWeek}
            {summary.weeklyTarget !== null ? ` / ${summary.weeklyTarget}` : ''} buổi
            {summary.weeklyTarget !== null ? ' hoàn thành' : ' đã tập'}
          </strong>
          <span>Tuần này</span>
        </div>
        <div className="fitness-summary-metric">
          <span className="overview-metric-icon"><AppIcon name="study" size={16} /></span>
          <strong>{known > 0 || summary.sessionsThisWeek === 0 ? fitnessDuration(summary.totalMinutes) : 'Chưa ghi thời lượng'}</strong>
          <span>Thời gian thực tế</span>
        </div>
      </div>
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
