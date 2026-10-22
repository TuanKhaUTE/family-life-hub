import { useEffect, useRef, useState } from 'react'
import { ProfileAvatar } from '../auth/ProfileSelector'
import {
  calendarError,
  deleteCalendarEvent,
  saveCalendarException,
  type CalendarOccurrence,
} from './calendar-api'
import { calendarDay, calendarTime, CATEGORY_LABELS } from './calendar-time'
import { familyDate } from '../meals/family-time'
import { ActivityPlans } from '../activities/ActivityPlans'

export function CalendarDetails({
  item,
  memberId,
  onClose,
  onEdit,
  onChanged,
}: {
  item: CalendarOccurrence
  memberId: string
  onClose: () => void
  onEdit: (occurrenceOnly: boolean) => void
  onChanged: (message: string) => void
}) {
  const own = item.owner.id === memberId
  const weekly = item.event.weekdays !== null
  const [confirm, setConfirm] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  async function mutate(remove: boolean) {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      if (remove) await deleteCalendarEvent(item.event.id)
      else
        await saveCalendarException(item.event.id, item.date, {
          cancelled: true,
        })
      onChanged(
        remove
          ? 'Đã xóa lịch của bạn.'
          : 'Đã hủy lần này. Các tuần khác vẫn giữ nguyên.',
      )
    } catch (error) {
      setError(calendarError(error))
      setPending(false)
    }
  }
  return (
    <section
      className="calendar-panel calendar-details"
      aria-label="Chi tiết lịch"
    >
      <div className="calendar-section-heading">
        <h2 ref={heading} tabIndex={-1}>
          {item.title}
        </h2>
        <button className="calendar-link" disabled={pending} onClick={onClose}>
          Đóng chi tiết
        </button>
      </div>
      <div className="calendar-owner">
        <ProfileAvatar profile={item.owner} />
        <strong>{item.owner.displayName}</strong>
      </div>
      <p>
        {calendarDay(familyDate(new Date(item.startsAt)))} ·{' '}
        {calendarTime(item.startsAt)}–{calendarTime(item.endsAt)}
        {familyDate(new Date(item.endsAt)) !==
        familyDate(new Date(item.startsAt))
          ? ` · Kết thúc ${calendarDay(familyDate(new Date(item.endsAt)))}`
          : ''}
      </p>
      <p>
        {CATEGORY_LABELS[item.event.category]}
        {weekly ? ' · Hàng tuần' : ''}
      </p>
      {item.isException && (
        <p className="calendar-hint">
          {item.cancelled ? 'Đã hủy lần này' : 'Đã đổi riêng lần này'} · Lần
          gốc: {calendarDay(item.date)}
        </p>
      )}
      {item.note && <p className="calendar-note">{item.note}</p>}
      {!own && (
        <p className="calendar-hint">Lịch của thành viên khác · Chỉ xem</p>
      )}
      {own && item.event.activity && <ActivityPlans kind={item.event.activity.kind} planId={item.event.activity.id} onChanged={() => onChanged('Đã cập nhật buổi của bạn.')} />}
      {own && !item.event.activity && (
        <div className="calendar-detail-actions">
          <button
            className="calendar-primary"
            disabled={pending}
            onClick={() => onEdit(weekly)}
          >
            {weekly
              ? item.cancelled
                ? 'Khôi phục / đổi lần này'
                : 'Chỉnh sửa lần này'
              : 'Chỉnh sửa'}
          </button>
          {weekly && (
            <button
              className="calendar-secondary"
              disabled={pending}
              onClick={() => onEdit(false)}
            >
              Chỉnh sửa cả lịch
            </button>
          )}
          {weekly && !item.cancelled && (
            <button
              className="calendar-secondary"
              disabled={pending}
              onClick={() => void mutate(false)}
            >
              Hủy lần này
            </button>
          )}
          <button
            className="calendar-link calendar-danger"
            disabled={pending}
            onClick={() => setConfirm(true)}
          >
            {weekly ? 'Xóa cả lịch' : 'Xóa lịch'}
          </button>
        </div>
      )}
      {confirm && (
        <div className="calendar-delete-confirm">
          <h3>Xóa lịch này?</h3>
          <p>
            {weekly
              ? 'Cả lịch hàng tuần và các thay đổi riêng sẽ được xóa.'
              : 'Lịch này sẽ được xóa khỏi lịch của cả nhà.'}
          </p>
          <button
            className="calendar-secondary"
            disabled={pending}
            onClick={() => setConfirm(false)}
          >
            Giữ lại
          </button>
          <button
            className="calendar-secondary calendar-danger"
            disabled={pending}
            onClick={() => void mutate(true)}
          >
            Đồng ý xóa
          </button>
        </div>
      )}
      {pending && <p role="status">Đang cập nhật lịch…</p>}
      {error && (
        <p role="alert" className="calendar-error">
          {error}
        </p>
      )}
    </section>
  )
}
