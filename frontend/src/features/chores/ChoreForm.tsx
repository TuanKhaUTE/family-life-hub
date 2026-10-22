import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  saveChore,
  choreError,
  CHORE_CATEGORIES,
  type ChoreSchedule,
  type ChoreMember,
  type ChoreInput,
} from './chore-api'
import { CHORE_LABELS } from './chore-display'
import { WEEKDAYS } from '../calendar/calendar-time'
export function ChoreForm({
  members,
  date,
  schedule,
  weeklyDefault,
  onClose,
  onSaved,
}: {
  members: ChoreMember[]
  date: string
  schedule: ChoreSchedule | null
  weeklyDefault: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [requestId] = useState(() => schedule?.requestId ?? crypto.randomUUID())
  const [title, setTitle] = useState(
    schedule?.title ?? (weeklyDefault ? 'Rửa bát' : ''),
  )
  const [category, setCategory] = useState<ChoreInput['category']>(
    schedule?.category ?? 'DISHES',
  )
  const [assignee, setAssignee] = useState(schedule?.assignedMemberId ?? '')
  const [start, setStart] = useState(schedule?.scheduledDate ?? date)
  const [time, setTime] = useState(schedule?.scheduledTime ?? '')
  const [weekly, setWeekly] = useState(
    schedule ? Boolean(schedule.weeklyAssignments.length) : weeklyDefault,
  )
  const [assignments, setAssignments] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      schedule?.weeklyAssignments.map((w) => [w.weekday, w.memberId]) ?? [],
    ),
  )
  const [until, setUntil] = useState(schedule?.recurrenceUntil ?? '')
  const [note, setNote] = useState(schedule?.note ?? '')
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const grid = Object.entries(assignments)
      .filter(([, m]) => m)
      .map(([d, m]) => ({ weekday: Number(d), memberId: m }))
      .sort((a, b) => a.weekday - b.weekday)
    if (!title.trim() || (!weekly && !assignee) || (weekly && !grid.length)) {
      setError('Bạn điền tên việc và chọn người làm cho ít nhất một ngày nhé.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await saveChore(
        {
          requestId,
          title: title.trim(),
          category,
          scheduledDate: start,
          scheduledTime: time || null,
          assignedMemberId: weekly ? null : assignee,
          weeklyAssignments: weekly ? grid : [],
          recurrenceUntil: weekly ? until || null : null,
          note: note.trim() || null,
        },
        schedule?.id ?? null,
      )
      onSaved()
    } catch (error) {
      setError(choreError(error))
      setPending(false)
    }
  }
  return (
    <section className="chore-form">
      <div className="chore-heading">
        <h3 ref={heading} tabIndex={-1}>
          {schedule
            ? 'Chỉnh sửa việc nhà'
            : weekly
              ? 'Lịch rửa bát hàng tuần'
              : 'Thêm việc nhà'}
        </h3>
        <button className="chore-link" disabled={pending} onClick={onClose}>
          Đóng biểu mẫu
        </button>
      </div>
      <form aria-label="Thông tin việc nhà" onSubmit={submit}>
        <fieldset disabled={pending}>
          <label>
            Tên việc
            <input
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Loại việc
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as ChoreInput['category'])
              }
            >
              {CHORE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CHORE_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ngày
            <input
              required
              type="date"
              min="2000-01-01"
              max="2199-12-31"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Giờ (không bắt buộc)
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          <p className="chore-hint">
            {category === 'DISHES'
              ? 'Để trống giờ nếu làm sau bữa tối.'
              : 'Để trống giờ nếu có thể làm trong ngày.'}
          </p>
          <label className="chore-checkbox">
            <input
              type="checkbox"
              checked={weekly}
              onChange={(e) => setWeekly(e.target.checked)}
            />
            Lặp hàng tuần
          </label>
          {weekly ? (
            <fieldset className="chore-weekly-grid">
              <legend>Giao việc theo ngày</legend>
              {WEEKDAYS.map((name, i) => (
                <label key={name}>
                  {name}
                  <select
                    value={assignments[i + 1] ?? ''}
                    onChange={(e) =>
                      setAssignments((current) => ({
                        ...current,
                        [i + 1]: e.target.value,
                      }))
                    }
                  >
                    <option value="">Không giao việc</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label>
                Lặp đến ngày (không bắt buộc)
                <input
                  type="date"
                  min={start}
                  max="2199-12-31"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
              </label>
            </fieldset>
          ) : (
            <label>
              Giao cho
              <select
                required
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              >
                <option value="">Chọn thành viên</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Ghi chú (không bắt buộc)
            <textarea
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {Boolean(schedule?.weeklyAssignments.length) && (
            <p className="chore-hint">
              Lịch mới áp dụng cho những lần chưa hoàn thành. Kết quả đã làm
              xong vẫn được giữ lại.
            </p>
          )}
          {error && (
            <p role="alert" className="chore-error">
              {error}
            </p>
          )}
          <button className="chore-primary" type="submit">
            {pending ? 'Đang lưu…' : 'Lưu việc'}
          </button>
        </fieldset>
      </form>
    </section>
  )
}
