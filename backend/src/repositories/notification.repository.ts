import type { SupabaseClient } from '@supabase/supabase-js'

import { createSupabaseServerClient } from '../config/supabase.js'
import type {
  AppNotification,
  NotificationRepository,
} from '../services/notification.service.js'
import { isBreakfastDate } from '../time/family-calendar.js'

interface NotificationRow {
  id: string
  recipient_member_id: string
  type: string
  title: string
  message: string
  related_resource_type: string | null
  related_resource_id: string | null
  related_date: string | null
  read_at: string | null
  created_at: string
}

type ClientFactory = () => SupabaseClient
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const COLUMNS =
  'id, recipient_member_id, type, title, message, related_resource_type, related_resource_id, related_date, read_at, created_at'

export class NotificationDataError extends Error {
  constructor() {
    super('Unable to access notifications')
    this.name = 'NotificationDataError'
  }
}

export class SupabaseNotificationRepository implements NotificationRepository {
  async countUnread(recipientMemberId: string): Promise<number> {
    const { count, error } = await this.getClient()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_member_id', recipientMemberId)
      .is('read_at', null)
    if (error || count === null || !Number.isInteger(count) || count < 0)
      throw new NotificationDataError()
    return count
  }
  private client?: SupabaseClient

  constructor(
    private readonly clientFactory: ClientFactory = createSupabaseServerClient,
  ) {}

  async listForRecipient(
    recipientMemberId: string,
  ): Promise<AppNotification[]> {
    const { data, error } = await this.getClient()
      .from('notifications')
      .select(COLUMNS)
      .eq('recipient_member_id', recipientMemberId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error || !Array.isArray(data) || !data.every(isNotificationRow)) {
      throw new NotificationDataError()
    }
    return data.map(toNotification)
  }

  async markRead(
    id: string,
    recipientMemberId: string,
    readAt: Date,
  ): Promise<AppNotification | null> {
    const { data, error } = await this.getClient()
      .from('notifications')
      .update({ read_at: readAt.toISOString() })
      .eq('id', id)
      .eq('recipient_member_id', recipientMemberId)
      .select(COLUMNS)
      .maybeSingle()

    if (error) throw new NotificationDataError()
    if (data === null) return null
    if (!isNotificationRow(data)) throw new NotificationDataError()
    return toNotification(data)
  }

  private getClient(): SupabaseClient {
    this.client ??= this.clientFactory()
    return this.client
  }
}

function isNotificationRow(value: unknown): value is NotificationRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  const validRelated =
    (row.related_resource_type === null && row.related_resource_id === null) ||
    (typeof row.related_resource_type === 'string' &&
      typeof row.related_resource_id === 'string' &&
      UUID_PATTERN.test(row.related_resource_id))
  return (
    typeof row.id === 'string' &&
    UUID_PATTERN.test(row.id) &&
    typeof row.recipient_member_id === 'string' &&
    UUID_PATTERN.test(row.recipient_member_id) &&
    typeof row.type === 'string' &&
    typeof row.title === 'string' &&
    typeof row.message === 'string' &&
    validRelated &&
    (row.related_date === null || isBreakfastDate(row.related_date)) &&
    (row.read_at === null || isTimestamp(row.read_at)) &&
    isTimestamp(row.created_at)
  )
}

function toNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    relatedResourceType: row.related_resource_type,
    relatedResourceId: row.related_resource_id,
    relatedDate: row.related_date,
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}
