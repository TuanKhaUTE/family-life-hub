import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cancelChoreSchedule,
  completeChore,
  fetchChores,
  saveChore,
  choreError,
  ChoreApiError,
  type ChoreInput,
} from './chore-api'
const id = '11111111-1111-4111-8111-111111111111'
const input: ChoreInput = {
  requestId: id,
  title: 'Việc thử nghiệm',
  category: 'OTHER',
  scheduledDate: '2026-10-22',
  scheduledTime: null,
  assignedMemberId: id,
  weeklyAssignments: [],
  recurrenceUntil: null,
  note: null,
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })
afterEach(() => vi.unstubAllGlobals())
describe('chore API boundary', () => {
  it('reads only safe profile fields and sends date/member filters with session credentials', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        json({
          chores: {
            from: input.scheduledDate,
            to: input.scheduledDate,
            timeZone: 'Asia/Ho_Chi_Minh',
            members: [
              {
                id,
                displayName: 'Thử nghiệm',
                avatarType: null,
                avatarValue: null,
                pin_hash: 'never expose',
              },
            ],
            chores: [],
          },
        }),
      )
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    const result = await fetchChores(
      input.scheduledDate,
      input.scheduledDate,
      id,
      signal,
    )
    expect(result.members[0]).not.toHaveProperty('pin_hash')
    expect(fetch).toHaveBeenCalledWith(
      `/api/chores?from=2026-10-22&to=2026-10-22&memberId=${id}`,
      {
        signal,
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      },
    )
  })
  it('rejects malformed data without exposing server internals', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ chores: { private: 'detail' } })),
    )
    await expect(
      fetchChores(
        input.scheduledDate,
        input.scheduledDate,
        null,
        new AbortController().signal,
      ),
    ).rejects.toThrow('Chore request failed')
  })
  it('preserves the create retry key and refreshes notifications after successful saves', async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () => json({ scheduleId: id }, 201))
    vi.stubGlobal('fetch', fetch)
    const refresh = vi.fn()
    window.addEventListener('family-notifications-changed', refresh)
    try {
      await saveChore(input, null)
      await saveChore(input, null)
      expect(refresh).toHaveBeenCalledTimes(2)
      expect(
        fetch.mock.calls.map((c) => JSON.parse(c[1].body).requestId),
      ).toEqual([id, id])
    } finally {
      window.removeEventListener('family-notifications-changed', refresh)
    }
  })
  it('updates an existing schedule and soft-cancels without sending a client actor', async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    await saveChore(input, id)
    await cancelChoreSchedule(id)
    expect(fetch.mock.calls[0][1].method).toBe('PUT')
    expect(fetch.mock.calls[1][1].method).toBe('DELETE')
    expect(fetch.mock.calls[0][1].body).not.toContain('actor')
  })
  it('does not refresh notifications on a failed write and shows a safe Vietnamese error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json(
            { error: { code: 'CHORE_FORBIDDEN', message: 'private details' } },
            403,
          ),
        ),
    )
    const refresh = vi.fn()
    window.addEventListener('family-notifications-changed', refresh)
    try {
      await expect(saveChore(input, null)).rejects.toMatchObject({
        code: 'CHORE_FORBIDDEN',
      })
      expect(refresh).not.toHaveBeenCalled()
      expect(choreError(new ChoreApiError('CHORE_FORBIDDEN'))).toContain(
        'Chỉ mẹ',
      )
      expect(choreError(new Error('private details'))).not.toContain('private')
    } finally {
      window.removeEventListener('family-notifications-changed', refresh)
    }
  })
  it('completion sends only an empty body, never a caller-supplied assignee', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    await completeChore(id, input.scheduledDate)
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: '{}',
      credentials: 'same-origin',
    })
  })
})
