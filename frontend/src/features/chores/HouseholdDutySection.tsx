import { useEffect, useState } from 'react'
import type { FamilyProfile } from '../auth/auth-api'
import { calendarDay, shiftDay, weekRange } from '../calendar/calendar-time'
import { HouseholdDutyCard } from './HouseholdDutyCard'
import {
  fetchHouseholdDuties,
  saveDutyWeek,
  duplicateDutyWeek,
  cancelDuty,
  dutyError,
  type HouseholdView,
} from './household-duty-api'
import './chores.css'

export function HouseholdDutySection({
  profile,
  from,
  to,
}: {
  profile: FamilyProfile
  from: string
  to: string
}) {
  const [data, setData] = useState<HouseholdView | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [version, setVersion] = useState(0)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const parent = profile.role === 'PARENT'
  useEffect(() => {
    const controller = new AbortController()
    void fetchHouseholdDuties(from, to, controller.signal)
      .then((view) => {
        if (!controller.signal.aborted) {
          setData(view)
          setState('ready')
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error')
      })
    return () => controller.abort()
  }, [from, to, version])
  function reload(text?: string) {
    setState('loading')
    setEditing(false)
    setMessage(text ?? null)
    setVersion((v) => v + 1)
  }
  return (
    <section className="chores-section" aria-label="Lịch việc nhà">
      <div className="chore-heading">
        <h2>{from === to ? 'Việc nhà hôm nay' : 'Việc nhà trong tuần'}</h2>
        {parent && state === 'ready' && (
          <button
            className="chore-secondary"
            onClick={() => setEditing((v) => !v)}
          >
            Quản lý việc nhà
          </button>
        )}
      </div>
      <p className="chore-hint">
        Mỗi ngày một người lo cả rửa chén và đổ rác. Lịch việc riêng trước đây
        vẫn được giữ trong lịch sử.
      </p>
      {message && <p role="status">{message}</p>}
      {state === 'loading' && <p role="status">Đang xem lịch việc nhà…</p>}
      {state === 'error' && (
        <>
          <p role="alert">Chưa xem được việc nhà. Bạn thử lại nhé.</p>
          <button className="chore-secondary" onClick={() => reload()}>
            Tải lại việc nhà
          </button>
        </>
      )}
      {state === 'ready' && data && (
        <>
          {editing && parent && (
            <DutyWeekEditor key={from} date={from} onSaved={reload} />
          )}
          {data.duties.length === 0 && (
            <p>Chưa phân công việc nhà trong khoảng này.</p>
          )}
          <div className="chore-list">
            {data.duties.map((duty) => (
              <HouseholdDutyCard
                key={duty.id}
                duty={duty}
                profile={profile}
                onChanged={() => reload('Đã xác nhận hoàn thành việc nhà.')}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
function DutyWeekEditor({
  date,
  onSaved,
}: {
  date: string
  onSaved: (message: string) => void
}) {
  const [source, setSource] = useState(date)
  const [data, setData] = useState<HouseholdView | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [copy, setCopy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const week = weekRange(source)
  useEffect(() => {
    const abort = new AbortController()
    void fetchHouseholdDuties(week.from, week.to, abort.signal)
      .then((view) => {
        if (abort.signal.aborted) return
        setData(view)
        setAssignments(
          Object.fromEntries(
            view.duties
              .filter((d) => !d.cancelled)
              .map((d) => [d.date, d.assignee.id]),
          ),
        )
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError('Chưa tải được tuần này. Bạn thử tải lại nhé.')
      })
    return () => abort.abort()
  }, [week.from, week.to, retry])
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(week.from, i))
  async function action(operation: () => Promise<unknown>, text: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await operation()
      onSaved(text)
    } catch (error) {
      setError(dutyError(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="chore-form" aria-label="Phân công tuần">
      <label>
        Chọn tuần phân công
        <input
          type="date"
          min="2000-01-03"
          max="2199-12-17"
          value={source}
          disabled={busy}
          onChange={(e) => {
            if (!e.target.value) return
            setSource(e.target.value)
            setData(null)
            setCopy(false)
            setError(null)
          }}
        />
      </label>
      {!data && !error && <p role="status">Đang tải phân công tuần…</p>}
      {error && <p role="alert">{error}</p>}
      {!data && error && (
        <button
          className="chore-secondary"
          onClick={() => {
            setError(null)
            setRetry((v) => v + 1)
          }}
        >
          Tải lại tuần
        </button>
      )}
      {data && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const selected = days
                .filter((day) => assignments[day])
                .map((day) => ({ date: day, memberId: assignments[day] }))
              if (!selected.length) {
                setError('Bạn chọn ít nhất một ngày cần phân công nhé.')
                return
              }
              void action(() => saveDutyWeek(selected), 'Đã lưu lịch việc nhà.')
            }}
          >
            <fieldset disabled={busy}>
              {days.map((day) => {
                const existing = data.duties.find((d) => d.date === day)
                return (
                  <div key={day} className="duty-assignment">
                    <label>
                      {calendarDay(day)}
                      <select
                        aria-label={`Người phụ trách ${day}`}
                        value={assignments[day] ?? ''}
                        disabled={!!existing?.completedAt}
                        onChange={(e) =>
                          setAssignments((a) => ({
                            ...a,
                            [day]: e.target.value,
                          }))
                        }
                      >
                        <option value="">Chưa phân công</option>
                        {data.members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.displayName}
                          </option>
                        ))}
                      </select>
                    </label>
                    {existing?.completedAt && <span>Đã hoàn thành ✓</span>}
                    {existing &&
                      !existing.cancelled &&
                      !existing.completedAt && (
                        <button
                          type="button"
                          className="chore-link chore-danger"
                          onClick={() =>
                            void action(
                              () => cancelDuty(day),
                              'Đã hủy phân công ngày này.',
                            )
                          }
                        >
                          Hủy phân công {calendarDay(day)}
                        </button>
                      )}
                    {existing &&
                      !existing.cancelled &&
                      !existing.completedAt &&
                      !assignments[day] && (
                        <p>
                          Để bỏ phân công đã lưu, chọn “Hủy phân công” ở trên.
                        </p>
                      )}
                  </div>
                )
              })}
              <button className="chore-primary">Lưu tuần</button>
            </fieldset>
          </form>
          <p className="chore-hint">
            Ngày không chọn được giữ nguyên. Việc đã hoàn thành không đổi người
            hay hủy được.
          </p>
          <button
            className="chore-secondary"
            disabled={busy}
            onClick={() => setCopy(true)}
          >
            Nhân bản tuần việc nhà
          </button>
          {copy && (
            <div className="chore-confirm">
              <p>
                Sao chép phân công đã lưu từ {calendarDay(week.from)} sang tuần
                bắt đầu {calendarDay(shiftDay(week.from, 7))}? Tuần đích có phân
                công khác sẽ không bị ghi đè. Chưa lưu thay đổi thì hãy lưu
                trước nhé.
              </p>
              <button
                className="chore-primary"
                disabled={busy}
                onClick={() =>
                  void action(
                    () => duplicateDutyWeek(week.from),
                    'Đã nhân bản tuần việc nhà. Không thêm phân công trùng.',
                  )
                }
              >
                Xác nhận nhân bản việc nhà
              </button>
              <button
                className="chore-secondary"
                disabled={busy}
                onClick={() => setCopy(false)}
              >
                Để sau
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
