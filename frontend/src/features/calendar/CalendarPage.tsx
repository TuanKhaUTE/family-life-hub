import { useEffect, useState } from 'react'
import type { FamilyProfile } from '../auth/auth-api'
import { ProfileAvatar } from '../auth/ProfileSelector'
import { familyDate } from '../meals/family-time'
import {
  fetchCalendar,
  type CalendarView,
  type CalendarOccurrence,
} from './calendar-api'
import { shiftDay, weekRange } from './calendar-time'
import { CalendarForm } from './CalendarForm'
import { CalendarDetails } from './CalendarDetails'
import './calendar.css'
import { HouseholdDutySection } from '../chores/HouseholdDutySection'
import { CalendarGrid } from './CalendarGrid'
import { CalendarWeekCopy } from './CalendarWeekCopy'
import { CalendarIllustration } from '../../ui/Illustration'

export function CalendarPage({ profile }: { profile: FamilyProfile }) {
  const [today] = useState(() => familyDate())
  const [date, setDate] = useState(today)
  const [view, setView] = useState<'DAY' | 'WEEK'>('DAY')
  const [memberId, setMemberId] = useState<string | null>(null)
  const [calendarType, setCalendarType] = useState<'FAMILY' | 'PERSONAL'>(
    'FAMILY',
  )
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
    void fetchCalendar(
      from,
      to,
      calendarType === 'PERSONAL' ? profile.id : memberId,
      controller.signal,
      calendarType,
    )
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
  }, [from, to, memberId, version, calendarType, profile.id])
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
        <div className="calendar-heading-copy">
          <p className="eyebrow">Thời gian của nhà mình</p>
          <h1>Lịch</h1>
          <p>Cùng nhau sắp xếp thời gian</p>
        </div>
        <CalendarIllustration />
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
      <div className="calendar-tabs" aria-label="Loại lịch">
        <button
          aria-pressed={calendarType === 'FAMILY'}
          onClick={() => {
            setCalendarType('FAMILY')
            setSelected(null)
            setForm(null)
            setData(null)
            reload()
          }}
        >
          Lịch nhà
        </button>
        {profile.role !== 'PARENT' && (
          <button
            aria-pressed={calendarType === 'PERSONAL'}
            onClick={() => {
              setCalendarType('PERSONAL')
              setSelected(null)
              setForm(null)
              setData(null)
              reload()
            }}
          >
            Lịch của tôi
          </button>
        )}
      </div>
      <p className="calendar-hint">
        {calendarType === 'FAMILY'
          ? 'Lịch nhà để cả nhà biết lịch đi học và những cuộc hẹn cần chia sẻ. Mỗi người chỉ sửa lịch của mình.'
          : 'Góc thời gian riêng của bạn, gồm lịch cá nhân và các kế hoạch Học & Luyện.'}
      </p>
      {calendarType === 'FAMILY' && (
        <CalendarWeekCopy date={date} onCopied={changed} />
      )}
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
        {calendarType === 'FAMILY' && (
          <button
            aria-expanded={showMembers}
            onClick={() => setShowMembers((v) => !v)}
          >
            Mọi người
          </button>
        )}
      </div>
      {showMembers && calendarType === 'FAMILY' && (
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
          calendarType={calendarType}
          allowPersonal={profile.role !== 'PARENT'}
          onClose={() => setForm(null)}
          onSaved={(day, kind) => {
            setCalendarType(kind)
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
        <p className="calendar-loading" role="status" aria-label="Tải lịch">
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
          className={`calendar-timeline${data.occurrences.length === 0 ? ' calendar-timeline--empty' : ''}`}
        >
          {data.occurrences.length === 0 && (
            <div className="calendar-empty-state">
              <CalendarIllustration />
              <div>
                <strong>
                  {view === 'DAY' ? 'Ngày này đang để trống' : 'Tuần này đang để trống'}
                </strong>
                <p>
                  Khoảng thời gian này chưa có lịch. Cả nhà có thể thong thả một
                  chút nhé.
                </p>
                <span>Dùng “Thêm lịch” ở trên nếu bạn muốn ghi lại một kế hoạch.</span>
              </div>
            </div>
          )}
          {data.occurrences.length > 0 && (
            <CalendarGrid
              focusDate={date}
              days={days}
              data={data}
              personal={calendarType === 'PERSONAL'}
              onSelect={(item) => {
                setSelected(item)
                setForm(null)
                setMessage(null)
              }}
            />
          )}
        </section>
      )}
      <HouseholdDutySection
        key={`${from}:${to}`}
        profile={profile}
        from={from}
        to={to}
      />
    </div>
  )
}
