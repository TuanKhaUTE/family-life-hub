import { useState } from 'react'
import type { FamilyProfile } from '../auth/auth-api'
import { ProfileAvatar } from '../auth/ProfileSelector'
import { FAMILY_TIME_ZONE, familyDate } from '../meals/family-time'
import { useFamilyClock } from '../meals/use-family-clock'
import { calendarDay } from '../calendar/calendar-time'
import {
  completeDuty,
  dutyError,
  type HouseholdDuty,
} from './household-duty-api'
import './chores.css'

export function HouseholdDutyCard({
  duty,
  profile,
  onChanged,
}: {
  duty: HouseholdDuty
  profile: FamilyProfile
  onChanged: () => void
}) {
  const now = useFamilyClock()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const own = duty.assignee.id === profile.id
  const today = duty.date === familyDate(now)
  return (
    <article className="chore-card">
      <p className="chore-hint">{calendarDay(duty.date)}</p>
      {own && today && !duty.cancelled && (
        <p>
          <strong>Hôm nay tới phiên bạn</strong>
        </p>
      )}
      <h3>Rửa chén &amp; Đổ rác</h3>
      <p className="calendar-owner">
        <ProfileAvatar profile={duty.assignee} />
        {duty.assignee.displayName}
      </p>
      <p>
        {duty.cancelled
          ? 'Đã hủy phân công'
          : duty.completedAt
            ? 'Đã hoàn thành ✓'
            : 'Chưa hoàn thành'}
      </p>
      {duty.completedAt && (
        <p className="chore-hint">
          {duty.assignee.displayName} ·{' '}
          {new Intl.DateTimeFormat('vi-VN', {
            timeZone: FAMILY_TIME_ZONE,
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
          }).format(new Date(duty.completedAt))}
        </p>
      )}
      {own && today && !duty.cancelled && !duty.completedAt && (
        <button
          className="chore-primary"
          disabled={busy}
          onClick={async () => {
            if (busy) return
            setBusy(true)
            setError(null)
            try {
              await completeDuty(duty.date)
              onChanged()
            } catch (error) {
              setError(dutyError(error))
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Đang xác nhận…' : 'Hoàn thành việc nhà ✓'}
        </button>
      )}
      {error && (
        <p className="chore-error" role="alert">
          {error}
        </p>
      )}
    </article>
  )
}
