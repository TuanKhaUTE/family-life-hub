import { useState } from 'react'
import { ProfileAvatar } from '../auth/ProfileSelector'
import { calendarDay } from '../calendar/calendar-time'
import {
  completeChore,
  cancelChore,
  cancelChoreSchedule,
  choreError,
  type ChoreItem,
  type ChoreSchedule,
} from './chore-api'
import { choreTime, CHORE_ICONS } from './chore-display'
export function ChoreCard({
  item,
  memberId,
  parent,
  today,
  onEdit,
  onChanged,
}: {
  item: ChoreItem
  memberId: string
  parent: boolean
  today: string
  onEdit: (schedule: ChoreSchedule) => void
  onChanged: (message: string) => void
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null),
    [confirm, setConfirm] = useState(false)
  async function act(action: 'complete' | 'cancel' | 'schedule') {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      if (action === 'complete')
        await completeChore(item.schedule.id, item.date)
      else if (action === 'cancel')
        await cancelChore(item.schedule.id, item.date)
      else await cancelChoreSchedule(item.schedule.id)
      onChanged(
        action === 'complete'
          ? 'Cảm ơn bạn đã chung tay việc nhà 💚'
          : action === 'cancel'
            ? 'Đã hủy lần này.'
            : 'Đã hủy lịch việc nhà.',
      )
    } catch (error) {
      setError(choreError(error))
      setPending(false)
    }
  }
  return (
    <article className={`chore-card chore-card--${item.status.toLowerCase()}`}>
      <div className="chore-card-main">
        <span className="chore-icon" aria-hidden="true">
          {item.status === 'COMPLETED'
            ? '✓'
            : CHORE_ICONS[item.schedule.category]}
        </span>
        <div>
          <div className="chore-assignee">
            <ProfileAvatar profile={item.assignee} />
            <span>{item.assignee.displayName}</span>
          </div>
          <h3>{item.schedule.title}</h3>
          <p className="chore-hint">
            {calendarDay(item.date)} · {choreTime(item.schedule)}
          </p>
        </div>
      </div>
      {item.status === 'COMPLETED' ? (
        <p className="chore-done">Hoàn thành ✓</p>
      ) : item.status === 'CANCELLED' ? (
        <p className="chore-hint">Đã hủy</p>
      ) : (
        <>
          {item.schedule.note && (
            <p className="chore-note">{item.schedule.note}</p>
          )}
          {item.assignee.id === memberId && item.date <= today && (
            <button
              className="chore-primary"
              disabled={pending}
              onClick={() => void act('complete')}
            >
              Đã làm xong
            </button>
          )}
          {item.date > today && (
            <p className="chore-hint">Đến ngày rồi mình cùng làm nhé.</p>
          )}
        </>
      )}
      {parent && !item.schedule.cancelled && item.status === 'PENDING' && (
        <div className="chore-actions">
          <button
            className="chore-link"
            disabled={pending}
            onClick={() => onEdit(item.schedule)}
          >
            Chỉnh sửa / giao lại
          </button>
          <button
            className="chore-link"
            disabled={pending}
            onClick={() => void act('cancel')}
          >
            Hủy lần này
          </button>
          <button
            className="chore-link chore-danger"
            disabled={pending}
            onClick={() => setConfirm(true)}
          >
            Hủy lịch việc
          </button>
        </div>
      )}
      {parent &&
        !item.schedule.cancelled &&
        item.status === 'COMPLETED' &&
        item.schedule.weeklyAssignments.length > 0 && (
          <button className="chore-link" onClick={() => onEdit(item.schedule)}>
            Sửa lịch các tuần sau
          </button>
        )}
      {confirm && (
        <div className="chore-confirm">
          <p>
            Hủy lịch việc này và các lần chưa hoàn thành? Việc đã làm xong vẫn
            được giữ lại.
          </p>
          <button
            className="chore-link"
            disabled={pending}
            onClick={() => setConfirm(false)}
          >
            Giữ lại
          </button>
          <button
            className="chore-link chore-danger"
            disabled={pending}
            onClick={() => void act('schedule')}
          >
            Đồng ý hủy lịch
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="chore-error">
          {error}
        </p>
      )}
    </article>
  )
}
