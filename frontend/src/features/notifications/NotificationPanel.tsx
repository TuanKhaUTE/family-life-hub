import { useEffect, useState } from 'react'

import {
  fetchNotifications,
  markNotificationRead,
  type AppNotification,
} from './notification-api'
import './notifications.css'

export function NotificationPanel() {
  const [items, setItems] = useState<AppNotification[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [readingId, setReadingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void fetchNotifications()
      .then((notifications) => {
        if (!active) return
        setItems(notifications)
        setState('ready')
      })
      .catch(() => {
        if (active) setState('error')
      })
    return () => { active = false }
  }, [reloadKey])

  async function handleRead(id: string) {
    if (readingId !== null) return
    setReadingId(id)
    setActionError(null)
    try {
      const updated = await markNotificationRead(id)
      setItems((current) => current.map((item) => item.id === id ? updated : item))
    } catch {
      setActionError('Chưa thể đánh dấu thông báo đã đọc.')
    } finally {
      setReadingId(null)
    }
  }

  return (
    <section className="notification-panel" aria-labelledby="notifications-title">
      <header className="notification-heading">
        <div>
          <p className="eyebrow">Lời nhắn gia đình</p>
          <h2 id="notifications-title">Thông báo</h2>
        </div>
        {state === 'ready' && items.some((item) => item.readAt === null) && (
          <span className="notification-count">
            {items.filter((item) => item.readAt === null).length} mới
          </span>
        )}
      </header>

      {state === 'loading' && <p className="notification-message" role="status">Đang tải thông báo…</p>}
      {state === 'error' && (
        <div className="notification-message notification-message--error">
          <p>Hiện chưa thể tải thông báo.</p>
          <button className="secondary-button" type="button" onClick={() => {
            setState('loading')
            setReloadKey((value) => value + 1)
          }}>Thử tải lại</button>
        </div>
      )}
      {state === 'ready' && items.length === 0 && (
        <p className="notification-message">Hiện chưa có thông báo nào.</p>
      )}
      {state === 'ready' && items.length > 0 && (
        <ul className="notification-list">
          {items.map((item) => (
            <li key={item.id} className={item.readAt === null ? 'is-unread' : ''}>
              <div className="notification-meta">
                <strong>{item.title}</strong>
                <span>{item.readAt === null ? 'Mới' : 'Đã đọc'}</span>
              </div>
              <p>{item.message}</p>
              {item.relatedDate && <time dateTime={item.relatedDate}>{formatDate(item.relatedDate)}</time>}
              {item.readAt === null && (
                <button type="button" className="notification-read" disabled={readingId !== null} onClick={() => void handleRead(item.id)}>
                  {readingId === item.id ? 'Đang đánh dấu…' : 'Đánh dấu đã đọc'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {actionError && <p className="notification-action-error" role="alert">{actionError}</p>}
    </section>
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { month: 'short', day: 'numeric' }).format(
    new Date(`${value}T12:00:00Z`),
  )
}
