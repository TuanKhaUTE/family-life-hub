import { useEffect, useState } from 'react'
import type { FamilyProfile } from '../auth/auth-api'
import { ProfileAvatar } from '../auth/ProfileSelector'
import { familyDate } from '../meals/family-time'
import {
  fetchCalendar,
  type CalendarView,
  type CalendarOccurrence,
} from './calendar-api'
import {
  calendarDay,
  calendarTime,
  shiftDay,
  weekRange,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
} from './calendar-time'
import { CalendarForm } from './CalendarForm'
import { CalendarDetails } from './CalendarDetails'
import './calendar.css'

export function CalendarPage({ profile }: { profile: FamilyProfile }) {
  const [today] = useState(() => familyDate())
  const [date, setDate] = useState(today)
  const [view, setView] = useState<'DAY' | 'WEEK'>('DAY')
  const [memberId, setMemberId] = useState<string | null>(null)
  const [showMembers, setShowMembers] = useState(true)
  const [data, setData] = useState<CalendarView | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [version, setVersion] = useState(0)
  const [selected, setSelected] = useState<CalendarOccurrence | null>(null)
  const [form, setForm] = useState<{
    item: CalendarOccurrence | null
    occurrenceOnly: boolean
  } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const { from, to } =
    view === 'WEEK' ? weekRange(date) : { from: date, to: date }
  useEffect(() => {
    const controller = new AbortController()
    void fetchCalendar(from, to, memberId, controller.signal)
      .then((calendar) => {
        if (!controller.signal.aborted) {
          setData(calendar)
          setState('ready')
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error')
      })
    return () => controller.abort()
  }, [from, to, memberId, version])
  function reload() {
    setState('loading')
    setVersion((v) => v + 1)
  }
  function changeDate(next: string) {
    if (!next) return
    setDate(next)
    setSelected(null)
    reload()
  }
  function changed(text: string) {
    setSelected(null)
    setForm(null)
    setMessage(text)
    reload()
  }
  const days = Array.from({ length: view === 'WEEK' ? 7 : 1 }, (_, i) =>
    shiftDay(from, i),
  )
  return (
    <div className="calendar-page">
      <header className="calendar-heading">
        <div>
          <p className="eyebrow">Thời gian của nhà mình</p>
          <h1>Lịch</h1>
          <p>Cùng nhau sắp xếp thời gian</p>
        </div>
        <button
          className="calendar-primary"
          onClick={() => {
            setForm({ item: null, occurrenceOnly: false })
            setSelected(null)
            setMessage(null)
          }}
        >
          Thêm lịch
        </button>
      </header>
      <div className="calendar-tabs" aria-label="Chế độ xem lịch">
        <button
          aria-pressed={view === 'DAY'}
          onClick={() => {
            setView('DAY')
            changeDate(today)
          }}
        >
          Hôm nay
        </button>
        <button
          aria-pressed={view === 'WEEK'}
          onClick={() => {
            setView('WEEK')
            changeDate(today)
          }}
        >
          Tuần này
        </button>
        <button
          aria-expanded={showMembers}
          onClick={() => setShowMembers((v) => !v)}
        >
          Mọi người
        </button>
      </div>
      {showMembers && (
        <div className="calendar-filters" aria-label="Lọc thành viên">
          <button
            aria-pressed={memberId === null}
            onClick={() => {
              setMemberId(null)
              setSelected(null)
              reload()
            }}
          >
            Tất cả
          </button>
          {data?.members.map((member, i) => (
            <button
              className={`calendar-tone-${i % 4}`}
              key={member.id}
              aria-pressed={memberId === member.id}
              onClick={() => {
                setMemberId(member.id)
                setSelected(null)
                reload()
              }}
            >
              <ProfileAvatar profile={member} />
              {member.displayName}
            </button>
          ))}
        </div>
      )}
      <div className="calendar-date-nav">
        <button
          className="calendar-secondary"
          aria-label={view === 'WEEK' ? 'Tuần trước' : 'Ngày trước'}
          onClick={() => changeDate(shiftDay(date, view === 'WEEK' ? -7 : -1))}
        >
          ‹
        </button>
        <label>
          Ngày xem
          <input
            type="date"
            min="2000-01-01"
            max="2199-12-31"
            value={date}
            onChange={(e) => changeDate(e.target.value)}
          />
        </label>
        <button
          className="calendar-secondary"
          aria-label={view === 'WEEK' ? 'Tuần sau' : 'Ngày sau'}
          onClick={() => changeDate(shiftDay(date, view === 'WEEK' ? 7 : 1))}
        >
          ›
        </button>
      </div>
      {message && (
        <p role="status" className="calendar-success">
          {message}
        </p>
      )}
      {form && (
        <CalendarForm
          key={`${form.item?.event.id ?? 'new'}:${form.occurrenceOnly}`}
          date={date}
          item={form.item}
          occurrenceOnly={form.occurrenceOnly}
          onClose={() => setForm(null)}
          onSaved={(day) => {
            setDate(day)
            setMemberId(profile.id)
            changed('Đã lưu lịch của bạn.')
          }}
        />
      )}
      {!form && selected && (
        <CalendarDetails
          key={`${selected.event.id}:${selected.date}`}
          item={selected}
          memberId={profile.id}
          onClose={() => setSelected(null)}
          onEdit={(occurrenceOnly) => {
            setForm({ item: selected, occurrenceOnly })
            setSelected(null)
          }}
          onChanged={changed}
        />
      )}
      {state === 'loading' && (
        <p className="calendar-loading" role="status">
          Đang xem lịch của cả nhà…
        </p>
      )}
      {state === 'error' && (
        <section className="calendar-panel">
          <p role="alert">Chưa xem được lịch của cả nhà. Bạn thử lại nhé.</p>
          <button className="calendar-secondary" onClick={reload}>
            Thử lại
          </button>
        </section>
      )}
      {state === 'ready' && data && (
        <section
          aria-label={view === 'WEEK' ? 'Lịch tuần' : 'Lịch hôm nay'}
          className="calendar-timeline"
        >
          {data.occurrences.length === 0 && (
            <p className="calendar-empty">
              Khoảng thời gian này chưa có lịch. Cả nhà có thể thong thả một
              chút nhé.
            </p>
          )}
          {days.map((day) => {
            const items = data.occurrences.filter((item) => {
              const local = familyDate(new Date(item.startsAt))
              return (local < from ? from : local) === day
            })
            return (
              <section key={day} className="calendar-day">
                <h2>{calendarDay(day)}</h2>
                {view === 'WEEK' && items.length === 0 && (
                  <p className="calendar-hint">Chưa có lịch</p>
                )}
                <ol>
                  {items.map((item) => {
                    const tone =
                      data.members.findIndex((m) => m.id === item.owner.id) % 4
                    return (
                      <li key={`${item.event.id}:${item.date}`}>
                        <span className="calendar-dot" aria-hidden="true" />
                        <button
                          className={`calendar-event calendar-tone-${tone}${item.cancelled ? ' calendar-cancelled' : ''}`}
                          onClick={() => {
                            setSelected(item)
                            setForm(null)
                            setMessage(null)
                          }}
                        >
                          <span className="calendar-event-time">
                            <time dateTime={item.startsAt}>
                              {calendarTime(item.startsAt)}
                            </time>
                            –
                            <time dateTime={item.endsAt}>
                              {calendarTime(item.endsAt)}
                            </time>
                          </span>
                          <span className="calendar-owner">
                            <ProfileAvatar profile={item.owner} />
                            {item.owner.displayName}
                          </span>
                          <strong>{item.title}</strong>
                          <span className="calendar-category">
                            <span aria-hidden="true">
                              {CATEGORY_ICONS[item.event.category]}{' '}
                            </span>
                            {CATEGORY_LABELS[item.event.category]}
                            {item.event.weekdays ? ' · Hàng tuần' : ''}
                          </span>
                          {item.cancelled && (
                            <span className="calendar-cancelled-label">
                              Đã hủy lần này
                            </span>
                          )}
                          {item.isException && !item.cancelled && (
                            <span className="calendar-hint">
                              Đã đổi riêng lần này
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </section>
            )
          })}
        </section>
      )}
    </div>
  )
}
