import { useState } from 'react'
import { calendarError, duplicateCalendarWeek } from './calendar-api'
import { calendarDay, shiftDay, weekRange } from './calendar-time'

export function CalendarWeekCopy({
  date,
  onCopied,
  calendarType = 'FAMILY',
}: {
  date: string
  onCopied: (message: string) => void
  calendarType?: 'FAMILY' | 'PERSONAL'
}) {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState(weekRange(date).from)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const personal = calendarType === 'PERSONAL'
  const triggerLabel = personal ? 'Nhân bản tuần của tôi' : 'Nhân bản tuần'
  const week = source ? weekRange(source).from : null
  if (!open)
    return (
      <button
        type="button"
        className="calendar-secondary calendar-week-copy-trigger"
        onClick={() => {
          setSource(weekRange(date).from)
          setOpen(true)
        }}
      >
        {triggerLabel}
      </button>
    )
  return (
    <form
      className="calendar-panel"
      aria-label={personal ? 'Nhân bản lịch của tôi' : 'Nhân bản lịch nhà'}
      onSubmit={async (e) => {
        e.preventDefault()
        if (busy || !week) return
        setBusy(true)
        setError(null)
        try {
          const copied = await duplicateCalendarWeek(week, calendarType)
          setOpen(false)
          onCopied(
            personal
              ? `Đã thêm ${copied} lịch riêng vào tuần sau. Lịch đã có không bị nhân đôi.`
              : `Đã thêm ${copied} lịch vào tuần sau. Lịch đã có không bị nhân đôi.`,
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
          {personal ? (
            <>
              Chỉ sao chép lịch cá nhân một lần của bạn từ {calendarDay(week)}–
              {calendarDay(shiftDay(week, 6))} sang tuần bắt đầu{' '}
              {calendarDay(shiftDay(week, 7))}. Kế hoạch Học &amp; Luyện sẽ được
              tạo thành kế hoạch mới, chưa hoàn thành. Lịch lặp đã có ở tuần
              sau và lịch đã có sẽ không bị nhân đôi.
            </>
          ) : (
            <>
              Chỉ sao chép lịch nhà của bạn từ {calendarDay(week)}–
              {calendarDay(shiftDay(week, 6))} sang tuần bắt đầu{' '}
              {calendarDay(shiftDay(week, 7))}. Lịch riêng và lịch của người khác
              không được sao chép. Buổi lặp đã có ở tuần sau được giữ nguyên.
            </>
          )}
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
