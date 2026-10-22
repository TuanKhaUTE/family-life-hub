import { useEffect, useState } from 'react'
import type { FamilyProfile } from '../auth/auth-api'
import { familyDate } from '../meals/family-time'
import { fetchChores, type ChoreView, type ChoreSchedule } from './chore-api'
import { ChoreForm } from './ChoreForm'
import { ChoreCard } from './ChoreCard'
import './chores.css'
export function ChoresSection({
  profile,
  from,
  to,
  memberId,
}: {
  profile: FamilyProfile
  from: string
  to: string
  memberId: string | null
}) {
  const parent = profile.role === 'PARENT',
    [today] = useState(() => familyDate())
  const [data, setData] = useState<ChoreView | null>(null),
    [failed, setFailed] = useState(false),
    [version, setVersion] = useState(0)
  const [form, setForm] = useState<{
      schedule: ChoreSchedule | null
      weekly: boolean
    } | null>(null),
    [message, setMessage] = useState<string | null>(null)
  const key = `${from}:${to}:${memberId}:${version}`
  const [loadedKey, setLoadedKey] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void fetchChores(from, to, memberId, controller.signal)
      .then((view) => {
        if (!controller.signal.aborted) {
          setData(view)
          setFailed(false)
          setLoadedKey(key)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailed(true)
          setLoadedKey(key)
        }
      })
    return () => controller.abort()
  }, [from, to, memberId, version, key])
  function reload() {
    setVersion((v) => v + 1)
  }
  function changed(text: string) {
    setMessage(text)
    setForm(null)
    reload()
  }
  const loading = key !== loadedKey
  const chores = data?.chores ?? []
  const ordered = parent
    ? chores
    : [...chores].sort(
        (a, b) =>
          Number(b.assignee.id === profile.id) -
          Number(a.assignee.id === profile.id),
      )
  return (
    <section
      className="chores-section"
      aria-label={from === to ? 'Việc nhà hôm nay' : 'Việc nhà trong tuần'}
    >
      <div className="chore-heading">
        <div>
          <p className="eyebrow">Cùng chăm chút tổ ấm</p>
          <h2>{from === to ? 'Việc nhà hôm nay' : 'Việc nhà trong tuần'}</h2>
        </div>
        <span className="chore-house" aria-hidden="true">
          🏡
        </span>
      </div>
      {parent && (
        <div className="chore-management">
          <h3>Quản lý việc nhà</h3>
          <div className="chore-actions">
            <button
              className="chore-primary"
              disabled={!data}
              onClick={() => {
                setForm({ schedule: null, weekly: false })
                setMessage(null)
              }}
            >
              Thêm việc
            </button>
            <button
              className="chore-secondary"
              disabled={!data}
              onClick={() => {
                setForm({ schedule: null, weekly: true })
                setMessage(null)
              }}
            >
              Lịch lặp hàng tuần
            </button>
          </div>
        </div>
      )}
      {form && parent && data && (
        <ChoreForm
          key={form.schedule?.id ?? `new-${form.weekly}`}
          date={from}
          members={data.members}
          schedule={form.schedule}
          weeklyDefault={form.weekly}
          onClose={() => setForm(null)}
          onSaved={() => changed('Đã lưu lịch việc nhà.')}
        />
      )}
      {message && (
        <p role="status" className="chore-success">
          {message}
        </p>
      )}
      {loading ? (
        <p role="status" className="chore-hint">
          Đang xem việc nhà của cả nhà…
        </p>
      ) : failed ? (
        <div>
          <p role="alert">Chưa xem được việc nhà. Bạn thử lại nhé.</p>
          <button className="chore-secondary" onClick={reload}>
            Thử lại
          </button>
        </div>
      ) : (
        <>
          {!parent && ordered.some((c) => c.assignee.id === profile.id) && (
            <h3>
              {from === to ? 'Việc của bạn hôm nay' : 'Việc của bạn trong tuần'}
            </h3>
          )}
          {ordered.length === 0 && (
            <p className="chore-hint">Hôm nay chưa có việc nhà cần làm.</p>
          )}
          <div className="chore-list">
            {ordered.map((item) => (
              <ChoreCard
                key={`${item.schedule.id}:${item.date}:${key}`}
                item={item}
                memberId={profile.id}
                parent={parent}
                today={today}
                onEdit={(schedule) => {
                  setForm({
                    schedule,
                    weekly: schedule.weeklyAssignments.length > 0,
                  })
                  setMessage(null)
                }}
                onChanged={changed}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
