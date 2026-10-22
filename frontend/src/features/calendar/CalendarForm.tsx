import { useEffect, useRef, useState, type FormEvent } from 'react'
import { localInputToUtc, toLocalDateTimeInput } from '../meals/family-time'
import {
  calendarError,
  saveCalendarEvent,
  saveCalendarException,
  CATEGORIES,
  type CalendarOccurrence,
  type CalendarInput,
} from './calendar-api'
import { CATEGORY_LABELS, WEEKDAYS } from './calendar-time'

export function CalendarForm({
  date,
  item,
  occurrenceOnly,
  onClose,
  onSaved,
  calendarType = 'FAMILY',
  allowPersonal = true,
}: {
  date: string
  item: CalendarOccurrence | null
  occurrenceOnly: boolean
  onClose: () => void
  onSaved: (date: string, kind: 'FAMILY' | 'PERSONAL') => void
  calendarType?: 'FAMILY' | 'PERSONAL'
  allowPersonal?: boolean
}) {
  const source = item ? (occurrenceOnly ? item : item.event) : null
  const [kind, setKind] = useState(item?.event.calendarType ?? calendarType)
  const start = source
    ? toLocalDateTimeInput(new Date(source.startsAt))
    : `${date}T09:00`
  const end = source
    ? toLocalDateTimeInput(new Date(source.endsAt))
    : `${date}T10:00`
  const [title, setTitle] = useState(source?.title ?? '')
  const [category, setCategory] = useState<CalendarInput['category']>(
    item?.event.category ?? 'OTHER',
  )
  const [day, setDay] = useState(start.slice(0, 10))
  const [endDay, setEndDay] = useState(end.slice(0, 10))
  const [startTime, setStartTime] = useState(start.slice(11))
  const [endTime, setEndTime] = useState(end.slice(11))
  const [note, setNote] = useState(source?.note ?? '')
  const [repeat, setRepeat] = useState(
    item?.event.weekdays && !occurrenceOnly ? 'WEEKLY' : 'NONE',
  )
  const [weekdays, setWeekdays] = useState<number[]>(
    item?.event.weekdays ?? [new Date(`${day}T12:00:00Z`).getUTCDay() || 7],
  )
  const [until, setUntil] = useState(item?.event.recurrenceUntil ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const startsAt = localInputToUtc(`${day}T${startTime}`),
      endsAt = localInputToUtc(
        `${repeat === 'WEEKLY' ? day : endDay}T${endTime}`,
      )
    if (
      !startsAt ||
      !endsAt ||
      startsAt >= endsAt ||
      !title.trim() ||
      (repeat === 'WEEKLY' && !weekdays.length)
    ) {
      setError(
        'Bạn kiểm tra ngày, giờ và chọn ít nhất một thứ nếu lặp hàng tuần nhé.',
      )
      return
    }
    setPending(true)
    setError(null)
    try {
      if (item && occurrenceOnly)
        await saveCalendarException(item.event.id, item.date, {
          cancelled: false,
          title: title.trim(),
          startsAt,
          endsAt,
          note: note.trim() || null,
        })
      else
        await saveCalendarEvent(
          {
            calendarType: kind,
            title: title.trim(),
            category,
            startsAt,
            endsAt,
            note: note.trim() || null,
            weekdays:
              repeat === 'WEEKLY' ? [...weekdays].sort((a, b) => a - b) : null,
            recurrenceUntil: repeat === 'WEEKLY' ? until || null : null,
          },
          item?.event.id ?? null,
        )
      onSaved(day, kind)
    } catch (error) {
      setError(calendarError(error))
      setPending(false)
    }
  }
  return (
    <section className="calendar-panel">
      <div className="calendar-section-heading">
        <h2 ref={heading} tabIndex={-1}>
          {item
            ? occurrenceOnly
              ? 'Đổi riêng lần này'
              : 'Chỉnh sửa lịch'
            : 'Thêm lịch của bạn'}
        </h2>
        <button className="calendar-link" onClick={onClose} disabled={pending}>
          Đóng biểu mẫu
        </button>
      </div>
      {occurrenceOnly && (
        <p className="calendar-hint">
          Chỉ thay đổi buổi này. Các tuần khác vẫn giữ nguyên.
        </p>
      )}
      <form aria-label="Thông tin lịch" onSubmit={submit}>
        <fieldset disabled={pending}>
          {!occurrenceOnly && allowPersonal && (
            <label>
              Nơi lưu lịch
              <select
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as 'FAMILY' | 'PERSONAL')
                }
              >
                <option value="FAMILY">Lịch nhà · Cả nhà cùng xem</option>
                <option value="PERSONAL">Lịch của tôi · Chỉ mình bạn</option>
              </select>
            </label>
          )}
          <label>
            Tiêu đề
            <input
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          {!occurrenceOnly && (
            <label>
              Loại hoạt động
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as CalendarInput['category'])
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Ngày
            <input
              required
              type="date"
              min="2000-01-01"
              max="2199-12-31"
              value={day}
              onChange={(e) => {
                setDay(e.target.value)
                if (endDay === day) setEndDay(e.target.value)
              }}
            />
          </label>
          <div className="calendar-form-row">
            <label>
              Giờ bắt đầu
              <input
                required
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </label>
            <label>
              Giờ kết thúc
              <input
                required
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </label>
          </div>
          {repeat !== 'WEEKLY' && (
            <label>
              Ngày kết thúc
              <input
                required
                type="date"
                min={day}
                max="2199-12-31"
                value={endDay}
                onChange={(e) => setEndDay(e.target.value)}
              />
            </label>
          )}
          {!occurrenceOnly && (
            <label>
              Lặp lại
              <select
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
              >
                <option value="NONE">Không lặp</option>
                <option value="WEEKLY">Hàng tuần</option>
              </select>
            </label>
          )}
          {repeat === 'WEEKLY' && !occurrenceOnly && (
            <>
              <fieldset className="calendar-weekdays">
                <legend>Lặp vào các ngày</legend>
                {WEEKDAYS.map((name, i) => (
                  <label key={name}>
                    <input
                      type="checkbox"
                      checked={weekdays.includes(i + 1)}
                      onChange={(e) =>
                        setWeekdays((current) =>
                          e.target.checked
                            ? [...current, i + 1]
                            : current.filter((n) => n !== i + 1),
                        )
                      }
                    />
                    {name}
                  </label>
                ))}
              </fieldset>
              <label>
                Lặp đến ngày (không bắt buộc)
                <input
                  type="date"
                  min={day}
                  max="2199-12-31"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
              </label>
              <p className="calendar-hint">
                Lịch hàng tuần bắt đầu và kết thúc trong cùng một ngày.
              </p>
            </>
          )}
          <label>
            Ghi chú (không bắt buộc)
            <textarea
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="calendar-error">
              {error}
            </p>
          )}
          <button className="calendar-primary" type="submit">
            {pending ? 'Đang lưu…' : 'Lưu lịch'}
          </button>
        </fieldset>
      </form>
    </section>
  )
}
