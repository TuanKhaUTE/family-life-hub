import { useEffect, useRef, useState, type FormEvent } from 'react'
import { familyDate } from '../meals/family-time'
import {
  saveFitness,
  fitnessError,
  type FitnessKind,
  type FitnessRecord,
  type FitnessWorkspace,
} from './fitness-api'
import { FITNESS_WEEKDAYS } from './fitness-display'
export function FitnessForm({
  kind,
  record,
  data,
  onClose,
  onSaved,
}: {
  kind: FitnessKind
  record: FitnessRecord | null
  data: FitnessWorkspace
  onClose: () => void
  onSaved: () => void
}) {
  const initial = record as unknown as Record<string, unknown> | null
  const [title, setTitle] = useState(
      String(initial?.name ?? initial?.title ?? ''),
    ),
    [note, setNote] = useState(String(initial?.note ?? '')),
    [active, setActive] = useState(Boolean(initial?.isActive ?? true)),
    [plan, setPlan] = useState(
      String(
        initial?.planId ??
          data.plans.find((p) => p.isActive)?.id ??
          data.plans[0]?.id ??
          '',
      ),
    ),
    [weekday, setWeekday] = useState(Number(initial?.weekday ?? 1)),
    [planned, setPlanned] = useState(String(initial?.planDayId ?? '')),
    [date, setDate] = useState(String(initial?.performedAt ?? familyDate())),
    [duration, setDuration] = useState(String(initial?.durationMinutes ?? '')),
    [target, setTarget] = useState(String(initial?.weeklySessionTarget ?? 3)),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    const input =
      kind === 'plans'
        ? { name: title.trim(), note: note.trim() || null, isActive: active }
        : kind === 'days'
          ? {
              planId: plan,
              weekday,
              title: title.trim(),
              note: note.trim() || null,
            }
          : kind === 'goals'
            ? { weeklySessionTarget: Number(target), isActive: true }
            : {
                title: title.trim(),
                note: note.trim() || null,
                planDayId: planned || null,
                performedAt: date,
                durationMinutes: duration ? Number(duration) : null,
              }
    try {
      await saveFitness(kind, record?.id ?? null, input)
      onSaved()
    } catch (error) {
      setError(fitnessError(error))
      setPending(false)
    }
  }
  const label = {
    plans: 'Kế hoạch tập',
    days: 'Ngày tập trong tuần',
    goals: 'Mục tiêu rèn luyện tuần',
    sessions: 'Buổi tập đã hoàn thành',
  }[kind]
  return (
    <section className="fitness-form">
      <div className="fitness-heading">
        <h3 ref={heading} tabIndex={-1}>
          {record ? 'Chỉnh sửa: ' : ''}
          {label}
        </h3>
        <button disabled={pending} onClick={onClose}>
          Đóng biểu mẫu rèn luyện
        </button>
      </div>
      <form aria-label={label} onSubmit={submit}>
        <fieldset disabled={pending}>
          {kind !== 'goals' && (
            <label>
              {kind === 'plans' ? 'Tên kế hoạch' : 'Tên buổi tập'}
              <input
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
          )}
          {kind === 'plans' && (
            <label className="fitness-check">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Kế hoạch đang dùng
            </label>
          )}
          {kind === 'days' && (
            <>
              <label>
                Kế hoạch
                <select
                  required
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                >
                  <option value="">Chọn kế hoạch</option>
                  {data.plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ngày trong tuần
                <select
                  value={weekday}
                  onChange={(e) => setWeekday(Number(e.target.value))}
                >
                  {FITNESS_WEEKDAYS.map((d, i) => (
                    <option value={i + 1} key={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {kind === 'sessions' && (
            <>
              <label>
                Buổi theo kế hoạch (không bắt buộc)
                <select
                  value={planned}
                  onChange={(e) => {
                    setPlanned(e.target.value)
                    if (!title.trim())
                      setTitle(
                        data.days.find((d) => d.id === e.target.value)?.title ??
                          '',
                      )
                  }}
                >
                  <option value="">Buổi tập tự do</option>
                  {data.days.map((d) => (
                    <option key={d.id} value={d.id}>
                      {FITNESS_WEEKDAYS[d.weekday - 1]} · {d.title} ·{' '}
                      {data.plans.find((p) => p.id === d.planId)?.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ngày đã tập
                <input
                  required
                  type="date"
                  min="2000-01-01"
                  max={familyDate()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label>
                Thời lượng tập (phút, không bắt buộc)
                <input
                  type="number"
                  min={1}
                  max={1440}
                  step={1}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </label>
            </>
          )}
          {kind === 'goals' && (
            <>
              <label>
                Số buổi mỗi tuần
                <input
                  required
                  type="number"
                  min={1}
                  max={21}
                  step={1}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </label>
              <p className="fitness-muted">
                Tuần tính từ thứ Hai đến Chủ nhật, theo giờ gia đình. Bạn chọn
                nhịp tập phù hợp với mình nhé.
              </p>
            </>
          )}
          {kind !== 'goals' && (
            <label>
              Ghi chú tập luyện (không bắt buộc)
              <textarea
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          )}
          {error && <p role="alert">{error}</p>}
          <button type="submit" className="fitness-primary">
            {pending ? 'Đang lưu…' : 'Lưu rèn luyện'}
          </button>
        </fieldset>
      </form>
    </section>
  )
}
