import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  fetchNotificationSummary,
  markNotificationRead,
  type AppNotification,
} from './notification-api'
import './notifications.css'
import { FAMILY_TIME_ZONE } from '../meals/family-time'
import { AppIcon } from '../../ui/AppIcon'

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
  const attempted = useRef(new Set<string>())
  const acknowledgements = useRef(new Map<string, AppNotification>())
  const [readRetry, setReadRetry] = useState(0)
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
          notifications
            .map((n) => ({
              ...n,
              readAt:
                n.readAt ?? acknowledgements.current.get(n.id)?.readAt ?? null,
            }))
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
        )
        setState('ready')
        setUnread(
          Math.max(
            0,
            unreadCount -
              notifications.filter(
                (n) => n.readAt === null && acknowledgements.current.has(n.id),
              ).length,
          ),
        )
      })
      .catch(() => {
        if (active) setState('error')
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  useEffect(() => {
    if (!open || state !== 'ready') return
    for (const item of items) {
      if (item.readAt !== null || attempted.current.has(item.id)) continue
      attempted.current.add(item.id)
      void markNotificationRead(item.id)
        .then((updated) => {
          if (updated.id !== item.id || updated.readAt === null)
            throw new Error('Read acknowledgement missing')
          if (!acknowledgements.current.has(item.id))
            setUnread((count) => Math.max(0, count - 1))
          acknowledgements.current.set(item.id, updated)
          if (
            items.every(
              (n) => n.readAt !== null || acknowledgements.current.has(n.id),
            )
          )
            setActionError(null)
          setItems((current) =>
            current.map((n) =>
              n.id === item.id ? { ...n, readAt: updated.readAt } : n,
            ),
          )
        })
        .catch(() => {
          if (!acknowledgements.current.has(item.id))
            setActionError(
              'Chưa thể xác nhận đã xem thông báo. Những mục này vẫn chưa được đánh dấu đã đọc.',
            )
        })
    }
  }, [open, state, items, readRetry])

  return (
    <>
      <button
        ref={bellRef}
        className="notification-bell"
        type="button"
        aria-label="Thông báo"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          attempted.current.clear()
          setActionError(null)
          setOpen((value) => !value)
        }}
      >
        <span className="notification-icon" aria-hidden="true">
          <AppIcon name="notification" size={20} />
        </span>
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
                        <span className="notification-item-icon" aria-hidden="true">
                          <AppIcon name="notification" size={17} />
                        </span>
                        <div className="notification-meta">
                          <strong>{item.title}</strong>
                          <span>{item.readAt === null ? 'Mới' : 'Đã đọc'}</span>
                        </div>
                        <p>{item.message}</p>
                        <time dateTime={item.createdAt}>
                          {formatTimestamp(item.createdAt)}
                        </time>
                        {item.relatedDate && (
                          <time dateTime={item.relatedDate}>
                            {formatRelatedDate(item.relatedDate)}
                          </time>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {actionError && (
                  <div className="notification-action-error">
                    <p role="alert">{actionError}</p>
                    <button
                      className="secondary-button"
                      onClick={() => {
                        attempted.current.clear()
                        setActionError(null)
                        setReadRetry((v) => v + 1)
                      }}
                    >
                      Thử xác nhận đã xem
                    </button>
                  </div>
                )}
              </section>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: FAMILY_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
}

function formatRelatedDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: FAMILY_TIME_ZONE,
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T12:00:00Z`))
}
