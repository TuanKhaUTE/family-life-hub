export interface AppNotification {
  id: string
  type: string
  title: string
  message: string
  relatedResourceType: string | null
  relatedResourceId: string | null
  relatedDate: string | null
  readAt: string | null
  createdAt: string
}

const SAFE_ERROR = 'Notifications are temporarily unavailable.'

export async function fetchNotifications(): Promise<AppNotification[]> {
  const body = await request('/api/notifications')
  if (!isObject(body) || !Array.isArray(body.notifications)) throw new Error(SAFE_ERROR)
  const notifications: unknown[] = body.notifications
  if (!notifications.every(isNotification)) throw new Error(SAFE_ERROR)
  return notifications
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const body = await request(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  })
  if (!isObject(body) || !isNotification(body.notification)) throw new Error(SAFE_ERROR)
  return body.notification
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  try {
    const response = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(SAFE_ERROR)
    return (await response.json()) as unknown
  } catch {
    throw new Error(SAFE_ERROR)
  }
}

function isNotification(value: unknown): value is AppNotification {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.title === 'string' &&
    typeof value.message === 'string' &&
    isNullableString(value.relatedResourceType) &&
    isNullableString(value.relatedResourceId) &&
    isNullableString(value.relatedDate) &&
    isNullableTimestamp(value.readAt) &&
    typeof value.createdAt === 'string' &&
    !Number.isNaN(Date.parse(value.createdAt))
  )
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isNullableTimestamp(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && !Number.isNaN(Date.parse(value)))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
