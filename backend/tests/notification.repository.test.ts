import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import {
  NotificationDataError,
  SupabaseNotificationRepository,
} from '../src/repositories/notification.repository.js'

interface Result { data: unknown; error: unknown }
type Method = 'select' | 'eq' | 'order' | 'limit' | 'update' | 'maybeSingle'
interface Operation { method: Method; arguments: unknown[] }

class Builder {
  operations: Operation[] = []
  constructor(private readonly result: Result) {}
  select(value: string): this { this.operations.push({ method: 'select', arguments: [value] }); return this }
  eq(column: string, value: unknown): this { this.operations.push({ method: 'eq', arguments: [column, value] }); return this }
  order(column: string, options: unknown): this { this.operations.push({ method: 'order', arguments: [column, options] }); return this }
  limit(value: number): Promise<Result> { this.operations.push({ method: 'limit', arguments: [value] }); return Promise.resolve(this.result) }
  update(value: unknown): this { this.operations.push({ method: 'update', arguments: [value] }); return this }
  maybeSingle(): Promise<Result> { this.operations.push({ method: 'maybeSingle', arguments: [] }); return Promise.resolve(this.result) }
}

class Client {
  queries: Array<{ table: string; builder: Builder }> = []
  results = new Map<string, Result>()
  from(table: string): Builder {
    const builder = new Builder(this.results.get(table) ?? { data: [], error: null })
    this.queries.push({ table, builder })
    return builder
  }
}

const memberId = '11111111-1111-4111-8111-111111111111'
const notificationId = '22222222-2222-4222-8222-222222222222'
const row = {
  id: notificationId,
  recipient_member_id: memberId,
  type: 'BREAKFAST_PURCHASED',
  title: 'Breakfast purchased',
  message: 'Breakfast is ready',
  related_resource_type: 'BREAKFAST_PURCHASE',
  related_resource_id: '33333333-3333-4333-8333-333333333333',
  related_date: '2026-10-22',
  read_at: null,
  created_at: '2026-10-21T12:00:00.000Z',
}

function harness() {
  const client = new Client()
  return {
    client,
    repository: new SupabaseNotificationRepository(
      () => client as unknown as SupabaseClient,
    ),
  }
}

describe('SupabaseNotificationRepository', () => {
  it('lists safe notifications newest first for one recipient', async () => {
    const { client, repository } = harness()
    client.results.set('notifications', { data: [row], error: null })

    await expect(repository.listForRecipient(memberId)).resolves.toEqual([
      {
        id: notificationId,
        type: row.type,
        title: row.title,
        message: row.message,
        relatedResourceType: row.related_resource_type,
        relatedResourceId: row.related_resource_id,
        relatedDate: row.related_date,
        readAt: null,
        createdAt: row.created_at,
      },
    ])
    expect(client.queries[0]!.builder.operations).toContainEqual({
      method: 'eq', arguments: ['recipient_member_id', memberId],
    })
    expect(client.queries[0]!.builder.operations).toContainEqual({
      method: 'order', arguments: ['created_at', { ascending: false }],
    })
  })

  it('marks read using both ID and recipient ownership filters', async () => {
    const { client, repository } = harness()
    const readAt = new Date('2026-10-21T13:00:00.000Z')
    client.results.set('notifications', {
      data: { ...row, read_at: readAt.toISOString() }, error: null,
    })

    await expect(repository.markRead(notificationId, memberId, readAt)).resolves.toMatchObject({
      id: notificationId, readAt: readAt.toISOString(),
    })
    expect(client.queries[0]!.builder.operations).toContainEqual({
      method: 'eq', arguments: ['id', notificationId],
    })
    expect(client.queries[0]!.builder.operations).toContainEqual({
      method: 'eq', arguments: ['recipient_member_id', memberId],
    })
  })

  it('returns null for a missing or foreign notification', async () => {
    const { client, repository } = harness()
    client.results.set('notifications', { data: null, error: null })
    await expect(repository.markRead(notificationId, memberId, new Date())).resolves.toBeNull()
  })

  it('rejects malformed data without exposing upstream details', async () => {
    const { client, repository } = harness()
    client.results.set('notifications', {
      data: [{ ...row, id: 'bad' }], error: { message: 'secret upstream detail' },
    })
    const result = repository.listForRecipient(memberId)
    await expect(result).rejects.toBeInstanceOf(NotificationDataError)
    await expect(result).rejects.not.toThrow('secret upstream detail')
  })
})
