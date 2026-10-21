import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { SupabaseNotificationRepository } from '../src/repositories/notification.repository.js'
describe('owner scoped notification count', () => {
  it('counts all unread notifications separately from the bounded panel list', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ count: 73, error: null }),
    }
    const repository = new SupabaseNotificationRepository(
      () => ({ from: vi.fn(() => builder) }) as unknown as SupabaseClient,
    )
    await expect(repository.countUnread('synthetic-owner')).resolves.toBe(73)
    expect(builder.select).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    })
    expect(builder.eq).toHaveBeenCalledWith(
      'recipient_member_id',
      'synthetic-owner',
    )
    expect(builder.is).toHaveBeenCalledWith('read_at', null)
  })
})
