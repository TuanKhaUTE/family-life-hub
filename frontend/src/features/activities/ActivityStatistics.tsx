import type { ActivityProgress } from './activity-api'
export function ActivityStatistics({ progress, compact = false, study = false }: { progress: ActivityProgress; compact?: boolean; study?: boolean }) {
  const c = progress.consistency
  return <div className="activity-statistics">
    <p>{study ? `Hôm nay đã học ${progress.today.minutes} phút` : `Hôm nay đã tập ${progress.today.sessions} buổi`}</p>
    {!compact && <p>Hôm nay: {progress.today.minutes} phút · {progress.today.sessions} buổi</p>}
    <p>Tuần này: {progress.week.minutes} phút · {progress.week.sessions} buổi</p>
    <p>{c.completed}/{c.planned} buổi tuần này</p>
    {!compact && <>
      <p>So với tuần trước: {signed(progress.week.differenceMinutes)} phút · {signed(progress.week.differenceSessions)} buổi{progress.week.percentage !== null ? ` · ${signed(progress.week.percentage)}%` : ' · Chưa có mốc thời lượng để tính phần trăm'}</p>
      <p>Tháng này: {progress.month.minutes} phút · {progress.month.sessions} buổi</p>
      <p>So với tháng trước: {signed(progress.month.differenceMinutes)} phút · {signed(progress.month.differenceSessions)} buổi{progress.month.percentage !== null ? ` · ${signed(progress.month.percentage)}%` : ' · Chưa có mốc thời lượng để tính phần trăm'}</p>
      <p>{c.streak} buổi đúng kế hoạch liên tiếp 🔥</p>
      <p className="activity-hint">Ngày nghỉ không ngắt chuỗi. Mỗi buổi có thể hoàn thành đến hết ngày đã hẹn. Chỉ thời lượng thực tế đã ghi mới cộng vào tiến độ.</p>
    </>}
  </div>
}
function signed(value: number) { return `${value > 0 ? '+' : ''}${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value)}` }
