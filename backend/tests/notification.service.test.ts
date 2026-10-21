import { describe, expect, it } from 'vitest'

import {
  NotificationNotFoundError,
  NotificationService,
  NotificationUnavailableError,
  NotificationValidationError,
  type AppNotification,
  type NotificationRepository,
} from '../src/services/notification.service.js'

const memberId = '11111111-1111-4111-8111-111111111111'
const notificationId = '22222222-2222-4222-8222-222222222222'
const item: AppNotification = {
  id: notificationId,
  type: 'BREAKFAST_PURCHASED',
  title: 'Breakfast purchased',
  message: 'Breakfast is ready',
  relatedResourceType: 'BREAKFAST_PURCHASE',
  relatedResourceId: '33333333-3333-4333-8333-333333333333',
  relatedDate: '2026-10-22',
  readAt: null,
  createdAt: '2026-10-21T12:00:00.000Z',
}

class FakeNotificationRepository implements NotificationRepository {
  items = [item]
  listCalls: string[] = []
  markCalls: Array<{ id: string; recipientMemberId: string; readAt: Date }> = []
  error?: Error

  async listForRecipient(recipientMemberId: string): Promise<AppNotification[]> {
    if (this.error) throw this.error
    this.listCalls.push(recipientMemberId)
    return this.items
  }

  async markRead(
    id: string,
    recipientMemberId: string,
    readAt: Date,
  ): Promise<AppNotification | null> {
    if (this.error) throw this.error
    this.markCalls.push({ id, recipientMemberId, readAt })
    const found = this.items.find((entry) => entry.id === id)
    return found ? { ...found, readAt: readAt.toISOString() } : null
  }
}

describe('NotificationService', () => {
  it('lists only through the authenticated recipient scope', async () => {
    const repository = new FakeNotificationRepository()
    const service = new NotificationService(repository)

    await expect(service.list(memberId)).resolves.toEqual([item])
    expect(repository.listCalls).toEqual([memberId])
  })

  it('marks only a recipient-owned notification read with the server clock', async () => {
    const repository = new FakeNotificationRepository()
    const now = new Date('2026-10-21T13:00:00.000Z')
    const service = new NotificationService(repository, () => now)

    await expect(service.markRead(memberId, notificationId)).resolves.toMatchObject({
      id: notificationId,
      readAt: now.toISOString(),
    })
    expect(repository.markCalls).toEqual([
      { id: notificationId, recipientMemberId: memberId, readAt: now },
    ])
  })

  it('uses the same safe not-found result for missing or foreign notifications', async () => {
    const repository = new FakeNotificationRepository()
    repository.items = []
    const service = new NotificationService(repository)

    await expect(service.markRead(memberId, notificationId)).rejects.toBeInstanceOf(
      NotificationNotFoundError,
    )
  })

  it('rejects a malformed notification ID before persistence', async () => {
    const repository = new FakeNotificationRepository()
    const service = new NotificationService(repository)

    await expect(service.markRead(memberId, 'not-a-uuid')).rejects.toBeInstanceOf(
      NotificationValidationError,
    )
    expect(repository.markCalls).toEqual([])
  })

  it('redacts repository failures', async () => {
    const repository = new FakeNotificationRepository()
    repository.error = new Error('secret database detail')
    const service = new NotificationService(repository)

    const result = service.list(memberId)
    await expect(result).rejects.toBeInstanceOf(NotificationUnavailableError)
    await expect(result).rejects.not.toThrow('secret database detail')
  })
})
