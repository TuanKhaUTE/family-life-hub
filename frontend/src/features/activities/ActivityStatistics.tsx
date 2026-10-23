import type { ActivityProgress } from './activity-api'
import { AppIcon } from '../../ui/AppIcon'
export function ActivityStatistics({ progress, compact = false, study = false }: { progress: ActivityProgress; compact?: boolean; study?: boolean }) {
  const c = progress.consistency
  const hasPreviousWeek = progress.week.previousMinutes > 0 || progress.week.previousSessions > 0
  const hasPreviousMonth = progress.month.previousMinutes > 0 || progress.month.previousSessions > 0
  return <div className="activity-statistics">
    <div className="activity-statistics-grid">
      <ActivityMetric icon={study ? 'study' : 'fitness'} value={`${progress.today.minutes} phút`} label="Hôm nay" />
      <ActivityMetric icon="calendar" value={`${progress.week.minutes} phút`} label="Tuần này" />
      <ActivityMetric icon="rating" value={c.planned ? `${c.completed} / ${c.planned}` : '—'} label={study ? 'Buổi đúng kế hoạch' : 'Buổi hoàn thành'} />
      <ActivityMetric icon="notification" value={c.planned ? String(c.streak) : '—'} label="Chuỗi kế hoạch" />
      {!compact && (progress.month.minutes > 0 || progress.month.sessions > 0) && <ActivityMetric icon="calendar" value={`${progress.month.minutes} phút`} label="Tháng này" />}
    </div>
    {!compact && hasPreviousWeek && <p className="activity-comparison">So với tuần trước: {signed(progress.week.differenceMinutes)} phút · {signed(progress.week.differenceSessions)} buổi{progress.week.percentage !== null ? ` · ${signed(progress.week.percentage)}%` : ''}</p>}
    {!compact && hasPreviousMonth && <p className="activity-comparison">So với tháng trước: {signed(progress.month.differenceMinutes)} phút · {signed(progress.month.differenceSessions)} buổi{progress.month.percentage !== null ? ` · ${signed(progress.month.percentage)}%` : ''}</p>}
    {c.planned === 0 && <p className="activity-hint">Chưa lên lịch buổi nào trong tuần này.</p>}
    <span className="visually-hidden">Hôm nay: {progress.today.minutes} phút · {progress.today.sessions} buổi</span>
    {!compact && <span className="visually-hidden">{c.streak} buổi đúng kế hoạch liên tiếp 🔥</span>}
    {!compact && <p className="activity-hint">Ngày nghỉ không ngắt chuỗi. Chỉ thời lượng thực tế đã ghi mới cộng vào tiến độ.</p>}
  </div>
}
function ActivityMetric({ icon, value, label }: { icon: 'study' | 'fitness' | 'calendar' | 'rating' | 'notification'; value: string; label: string }) {
  return <div className="activity-metric"><span className="overview-metric-icon"><AppIcon name={icon} size={16} /></span><strong>{value}</strong><span>{label}</span></div>
}
function signed(value: number) { return `${value > 0 ? '+' : ''}${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value)}` }
