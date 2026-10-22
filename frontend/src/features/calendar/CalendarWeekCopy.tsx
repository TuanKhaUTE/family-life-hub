import { useState } from 'react'
import { calendarError, duplicateCalendarWeek } from './calendar-api'
import { calendarDay, shiftDay, weekRange } from './calendar-time'

export function CalendarWeekCopy({
  date,
  onCopied,
}: {
  date: string
  onCopied: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState(weekRange(date).from)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const week = source ? weekRange(source).from : null
  if (!open)
    return (
      <button
        className="calendar-secondary"
        onClick={() => {
          setSource(weekRange(date).from)
          setOpen(true)
        }}
      >
        Nhân bản tuần
      </button>
    )
  return (
    <form
      className="calendar-panel"
      aria-label="Nhân bản lịch nhà"
      onSubmit={async (e) => {
        e.preventDefault()
        if (busy || !week) return
        setBusy(true)
        setError(null)
        try {
          const copied = await duplicateCalendarWeek(week)
          setOpen(false)
          onCopied(
            `Đã thêm ${copied} lịch vào tuần sau. Lịch đã có không bị nhân đôi.`,
          )
        } catch (error) {
          setError(calendarError(error))
        } finally {
          setBusy(false)
        }
      }}
    >
      <label>
        Chọn ngày trong tuần nguồn
        <input
          type="date"
          required
          min="2000-01-03"
          max="2199-12-17"
          value={source}
          disabled={busy}
          onChange={(e) => setSource(e.target.value)}
        />
      </label>
      {week && (
        <p>
          Chỉ sao chép lịch nhà của bạn từ {calendarDay(week)}–
          {calendarDay(shiftDay(week, 6))} sang tuần bắt đầu{' '}
          {calendarDay(shiftDay(week, 7))}. Lịch riêng và lịch của người khác
          không được sao chép. Buổi lặp đã có ở tuần sau được giữ nguyên.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="calendar-detail-actions">
        <button className="calendar-primary" disabled={busy || !week}>
          Xác nhận nhân bản lịch
        </button>
        <button
          type="button"
          className="calendar-secondary"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          Để sau
        </button>
      </div>
    </form>
  )
}
