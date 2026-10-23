import { useEffect, useState } from 'react'
import { AppIcon } from '../../ui/AppIcon'
import { fetchActivities, type ActivityView } from '../activities/activity-api'
import { fetchWellness, type WellnessWorkspace } from '../wellness/wellness-api'
import { fitnessDuration } from '../fitness/fitness-display'
import { wellnessChange, wellnessNumber } from '../wellness/wellness-display'
import { studyDuration } from './StudyProgress'
import type { StudyWorkspace } from './study-api'

type OverviewData = {
  study: StudyWorkspace
  studyActivities: ActivityView
  fitness: ActivityView
  wellness: WellnessWorkspace
}

export function StudyOverview({ study }: { study: StudyWorkspace }) {
  const [data, setData] = useState<OverviewData | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      fetchActivities('STUDY', controller.signal),
      fetchActivities('FITNESS', controller.signal),
      fetchWellness(controller.signal),
    ])
      .then(([studyActivities, fitness, wellness]) => {
        if (!controller.signal.aborted) {
          setData({ study, studyActivities, fitness, wellness })
          setState('ready')
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error')
      })
    return () => controller.abort()
  }, [study, version])

  if (state === 'loading') {
    return <p className="study-overview-message" role="status">Đang mở Tổng quan…</p>
  }
  if (state === 'error' || !data) {
    return (
      <div className="study-overview-message">
        <p role="alert">Chưa tải được Tổng quan. Bạn thử lại nhé.</p>
        <button onClick={() => { setState('loading'); setVersion((value) => value + 1) }}>Thử lại</button>
      </div>
    )
  }

  const studyProgress = data.studyActivities
  const goalsWithTargets = data.study.summary.goals.filter(
    (goal) => goal.targetMinutes !== null,
  )
  const goalMinutes = goalsWithTargets.reduce((total, goal) => total + goal.minutes, 0)
  const goalTarget = goalsWithTargets.reduce((total, goal) => total + (goal.targetMinutes ?? 0), 0)
  const fitnessProgress = data.fitness
  const nextWorkout = fitnessProgress.plans
    .filter((plan) => !plan.cancelled && !plan.completedAt)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0]
  const currentWeight = data.wellness.summary.currentWeightKg

  return (
    <section id="study-panel-overview" className="study-overview" aria-label="Tổng quan Học và Luyện">
      <div className="study-overview-intro">
        <div>
          <p className="eyebrow">Nhìn nhanh một vòng 🌿</p>
          <h2>Tổng quan</h2>
          <p className="study-muted">Những con số thật trong tuần này, gọn để bạn bắt nhịp.</p>
        </div>
        <span className="icon-well"><AppIcon name="study" size={21} /></span>
      </div>

      <section className="overview-module overview-module-study" aria-labelledby="overview-study-title">
        <h3 id="overview-study-title"><span className="icon-well"><AppIcon name="study" size={18} /></span>Học tập</h3>
        <div className="overview-metrics">
          <Metric icon="study" value={studyDuration(data.study.summary.totalMinutes)} label="Tuần này" />
          <Metric
            icon="calendar"
            value={studyProgress.progress.consistency.planned ? `${studyProgress.progress.consistency.completed} / ${studyProgress.progress.consistency.planned}` : '—'}
            label="Buổi đúng kế hoạch"
          />
          <Metric
            icon="rating"
            value={goalTarget ? `${Math.min(100, Math.round((goalMinutes / goalTarget) * 100))}%` : '—'}
            label={goalTarget ? 'Tiến độ mục tiêu' : 'Chưa đặt mục tiêu'}
          />
          <Metric
            icon="notification"
            value={studyProgress.progress.consistency.planned ? String(studyProgress.progress.consistency.streak) : '—'}
            label="Chuỗi kế hoạch"
          />
          {(studyProgress.progress.month.minutes > 0 || studyProgress.progress.month.sessions > 0) && (
            <Metric icon="calendar" value={fitnessDuration(studyProgress.progress.month.minutes)} label="Tháng này" />
          )}
        </div>
        {!data.study.summary.totalMinutes && !studyProgress.progress.consistency.planned && (
          <p className="overview-empty">Chưa có buổi học hoặc kế hoạch tuần này.</p>
        )}
      </section>

      <section className="overview-module overview-module-fitness" aria-labelledby="overview-fitness-title">
        <h3 id="overview-fitness-title"><span className="icon-well"><AppIcon name="fitness" size={18} /></span>Rèn luyện</h3>
        <div className="overview-metrics">
          <Metric
            icon="fitness"
            value={fitnessProgress.progress.consistency.planned ? `${fitnessProgress.progress.consistency.completed} / ${fitnessProgress.progress.consistency.planned}` : '—'}
            label="Buổi hoàn thành"
          />
          <Metric icon="study" value={fitnessDuration(fitnessProgress.progress.week.minutes)} label="Thời gian thực tế" />
          <Metric
            icon="rating"
            value={fitnessProgress.progress.consistency.planned ? String(fitnessProgress.progress.consistency.streak) : '—'}
            label="Chuỗi đúng kế hoạch"
          />
          <Metric
            icon="calendar"
            value={nextWorkout?.title ?? '—'}
            label="Buổi tiếp theo"
            text
          />
        </div>
        {!fitnessProgress.progress.week.minutes && !fitnessProgress.progress.consistency.planned && (
          <p className="overview-empty">Chưa có buổi tập. Bạn có thể lên lịch khi sẵn sàng.</p>
        )}
      </section>

      <section className="overview-module overview-module-wellness" aria-labelledby="overview-wellness-title">
        <h3 id="overview-wellness-title"><span className="icon-well"><AppIcon name="personal" size={18} /></span>Thể trạng</h3>
        <div className="overview-metrics">
          <Metric icon="personal" value={currentWeight === null ? '—' : `${wellnessNumber(currentWeight)} kg`} label="Cân nặng hiện tại" text />
          <Metric icon="rating" value={data.wellness.profile?.targetWeightKg == null ? '—' : `${wellnessNumber(data.wellness.profile.targetWeightKg)} kg`} label="Mục tiêu" text />
          <Metric icon="calendar" value={data.wellness.summary.changeKg === null ? '—' : wellnessChange(data.wellness.summary.changeKg)} label="Thay đổi gần đây" text />
          <Metric icon="study" value={data.wellness.summary.bmi === null ? '—' : wellnessNumber(data.wellness.summary.bmi)} label="BMI tham khảo" text />
        </div>
        {currentWeight === null && <p className="overview-empty">Chưa có dữ liệu thể trạng. Góc này chỉ dành riêng cho bạn.</p>}
      </section>
    </section>
  )
}

function Metric({
  icon,
  value,
  label,
  text = false,
}: {
  icon: 'study' | 'fitness' | 'calendar' | 'rating' | 'notification' | 'personal'
  value: string
  label: string
  text?: boolean
}) {
  return (
    <div className={`overview-metric${text ? ' overview-metric-text' : ''}`}>
      <span className="overview-metric-icon"><AppIcon name={icon} size={16} /></span>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}
