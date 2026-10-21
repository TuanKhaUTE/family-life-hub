import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  fetchNotificationSummary,
  markNotificationRead,
  type AppNotification,
} from './notification-api'
import './notifications.css'

export function NotificationPanel() {
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const bellRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const bell = bellRef.current
    document.body.style.overflow = 'hidden'
    sheetRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      bell?.focus()
    }
  }, [open])
  const [items, setItems] = useState<AppNotification[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [readingId, setReadingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => setReloadKey((value) => value + 1)
    window.addEventListener('family-notifications-changed', refresh)
    return () =>
      window.removeEventListener('family-notifications-changed', refresh)
  }, [])

  useEffect(() => {
    let active = true
    void fetchNotificationSummary()
      .then(({ notifications, unreadCount }) => {
        if (!active) return
        setItems(
          [...notifications].sort(
            (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
          ),
        )
        setState('ready')
        setUnread(unreadCount)
      })
      .catch(() => {
        if (active) setState('error')
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  async function handleRead(id: string) {
    if (readingId !== null) return
    setReadingId(id)
    setActionError(null)
    try {
      const updated = await markNotificationRead(id)
      if (
        items.some((item) => item.id === id && item.readAt === null) &&
        updated.readAt !== null
      )
        setUnread((count) => Math.max(0, count - 1))
      setItems((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      )
    } catch {
      setActionError('Chưa thể đánh dấu thông báo đã đọc.')
    } finally {
      setReadingId(null)
    }
  }

  return (
    <>
      <button
        ref={bellRef}
        className="notification-bell"
        type="button"
        aria-label="Thông báo"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">🔔</span>
        {state === 'ready' && unread > 0 && (
          <span
            className="notification-badge"
            aria-label={`${unread} thông báo chưa đọc`}
          >
            {unread}
          </span>
        )}
      </button>
      {open &&
        createPortal(
          <div
            className="notification-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) setOpen(false)
            }}
          >
            <div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-label="Thông báo"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation()
                  setOpen(false)
                }
                if (event.key === 'Tab') {
                  const controls =
                    sheetRef.current?.querySelectorAll<HTMLButtonElement>(
                      'button:not(:disabled)',
                    )
                  if (!controls?.length) return
                  const first = controls[0]!,
                    last = controls[controls.length - 1]!
                  if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault()
                    last.focus()
                  } else if (
                    !event.shiftKey &&
                    document.activeElement === last
                  ) {
                    event.preventDefault()
                    first.focus()
                  }
                }
              }}
            >
              <button
                type="button"
                className="notification-close secondary-button"
                onClick={() => setOpen(false)}
              >
                Đóng thông báo
              </button>
              <section
                className="notification-panel"
                aria-labelledby="notifications-title"
              >
                <header className="notification-heading">
                  <div>
                    <p className="eyebrow">Lời nhắn gia đình</p>
                    <h2 id="notifications-title">Thông báo</h2>
                  </div>
                  {state === 'ready' &&
                    items.some((item) => item.readAt === null) && (
                      <span className="notification-count">
                        {items.filter((item) => item.readAt === null).length}{' '}
                        mới
                      </span>
                    )}
                </header>

                {state === 'loading' && (
                  <p className="notification-message" role="status">
                    Đang tải thông báo…
                  </p>
                )}
                {state === 'error' && (
                  <div className="notification-message notification-message--error">
                    <p>Hiện chưa thể tải thông báo.</p>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        setState('loading')
                        setReloadKey((value) => value + 1)
                      }}
                    >
                      Thử tải lại
                    </button>
                  </div>
                )}
                {state === 'ready' && items.length === 0 && (
                  <p className="notification-message">
                    Hiện chưa có thông báo nào.
                  </p>
                )}
                {state === 'ready' && items.length > 0 && (
                  <ul className="notification-list">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className={item.readAt === null ? 'is-unread' : ''}
                      >
                        <div className="notification-meta">
                          <strong>{item.title}</strong>
                          <span>{item.readAt === null ? 'Mới' : 'Đã đọc'}</span>
                        </div>
                        <p>{item.message}</p>
                        {item.relatedDate && (
                          <time dateTime={item.relatedDate}>
                            {formatDate(item.relatedDate)}
                          </time>
                        )}
                        {item.readAt === null && (
                          <button
                            type="button"
                            className="notification-read"
                            disabled={readingId !== null}
                            onClick={() => void handleRead(item.id)}
                          >
                            {readingId === item.id
                              ? 'Đang đánh dấu…'
                              : 'Đánh dấu đã đọc'}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {actionError && (
                  <p className="notification-action-error" role="alert">
                    {actionError}
                  </p>
                )}
              </section>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T12:00:00Z`))
}
