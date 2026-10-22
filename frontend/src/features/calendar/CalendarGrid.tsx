import type { CalendarOccurrence, CalendarView } from './calendar-api'
import { useEffect, useRef } from 'react'
import { calendarDay, calendarTime, CATEGORY_LABELS } from './calendar-time'
import { calendarLayout, HOUR_HEIGHT } from './calendar-layout'

export function CalendarGrid({
  days,
  data,
  personal,
  onSelect,
  focusDate,
}: {
  days: string[]
  data: CalendarView
  personal: boolean
  onSelect: (item: CalendarOccurrence) => void
  focusDate?: string
}) {
  const layouts = days.map((day) => calendarLayout(data.occurrences, day))
  const scroll = useRef<HTMLDivElement>(null)
  const dayKey = days.join(',')
  const first = layouts.flat().map((e) => e.top)
  const firstTop = first.length ? Math.min(...first) : 8 * HOUR_HEIGHT
  useEffect(() => {
    if (scroll.current)
      scroll.current.scrollTop = Math.max(0, firstTop - HOUR_HEIGHT)
  }, [dayKey, firstTop])
  useEffect(() => {
    const index = focusDate ? dayKey.split(',').indexOf(focusDate) : 0
    const column =
      scroll.current?.querySelectorAll<HTMLElement>('.calendar-grid-day')[
        Math.max(0, index)
      ]
    if (scroll.current && column)
      scroll.current.scrollLeft = Math.max(0, column.offsetLeft - 46)
  }, [dayKey, focusDate])
  const columns = layouts
    .map(
      (events) =>
        `minmax(${Math.max(days.length > 1 ? 150 : 0, ...events.map((e) => e.lanes * 96))}px, 1fr)`,
    )
    .join(' ')
  return (
    <div
      ref={scroll}
      className="calendar-grid-scroll"
      tabIndex={0}
      aria-label="Lưới lịch theo giờ"
    >
      <div
        className={`calendar-grid ${days.length > 1 ? 'calendar-grid-week' : ''}`}
        style={{ gridTemplateColumns: `46px ${columns}` }}
      >
        <div className="calendar-grid-corner">Giờ</div>
        {days.map((day) => (
          <h2 className="calendar-grid-heading" key={day}>
            {calendarDay(day)}
          </h2>
        ))}
        <div
          className="calendar-hours"
          aria-label="Trục giờ"
          style={{ height: 24 * HOUR_HEIGHT }}
        >
          {Array.from({ length: 24 }, (_, hour) => (
            <span key={hour} style={{ top: hour * HOUR_HEIGHT }}>
              {String(hour).padStart(2, '0')}:00
            </span>
          ))}
        </div>
        {days.map((day, index) => (
          <div
            className="calendar-grid-day"
            key={day}
            style={{
              height: 24 * HOUR_HEIGHT,
              backgroundSize: `100% ${HOUR_HEIGHT}px`,
            }}
          >
            {layouts[index].map(({ item, top, bottom, lane, lanes }) => {
              const tone = personal
                ? [
                    'SCHOOL',
                    'WORK',
                    'FITNESS',
                    'FAMILY',
                    'APPOINTMENT',
                    'PERSONAL',
                    'OTHER',
                  ].indexOf(item.event.category) % 4
                : Math.max(
                    0,
                    data.members.findIndex((m) => m.id === item.owner.id),
                  ) % 4
              return (
                <button
                  key={`${item.event.id}:${item.date}`}
                  className={`calendar-block calendar-tone-${tone}${item.cancelled ? ' calendar-cancelled' : ''}`}
                  style={{
                    top,
                    height: bottom - top,
                    left: `calc(${(lane / lanes) * 100}% + 2px)`,
                    width: `calc(${100 / lanes}% - 4px)`,
                  }}
                  onClick={() => onSelect(item)}
                  aria-label={`${calendarTime(item.startsAt)}–${calendarTime(item.endsAt)} · ${item.owner.displayName} · ${item.title}${item.cancelled ? ' · Đã hủy lần này' : ''}`}
                >
                  <strong>{item.title}</strong>
                  <span className="calendar-event-time">
                    <time dateTime={item.startsAt}>
                      {calendarTime(item.startsAt)}
                    </time>
                    –
                    <time dateTime={item.endsAt}>
                      {calendarTime(item.endsAt)}
                    </time>
                  </span>
                  {!personal && (
                    <span className="calendar-block-owner">
                      {item.owner.displayName}
                    </span>
                  )}
                  {bottom - top >= 100 && (
                    <span className="calendar-category">
                      {CATEGORY_LABELS[item.event.category]}
                      {item.event.weekdays ? ' · Hàng tuần' : ''}
                    </span>
                  )}
                  {item.cancelled && bottom - top >= 100 && (
                    <span className="calendar-cancelled-label">
                      Đã hủy lần này
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
