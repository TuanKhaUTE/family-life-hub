import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { SupabaseCalendarRepository } from '../src/repositories/calendar.repository.js'
const id = '11111111-1111-4111-8111-111111111111'
const owner = {
  id,
  displayName: 'Synthetic Calendar Member',
  avatarType: null,
  avatarValue: null,
}
const event = {
  id,
  ownerMemberId: id,
  title: 'Hoạt động thử nghiệm',
  category: 'SCHOOL' as const,
  startsAt: '2099-05-04T02:00:00Z',
  endsAt: '2099-05-04T04:00:00Z',
  note: null,
  weekdays: [1],
  recurrenceUntil: null,
  createdAt: '2099-05-01T00:00:00Z',
  updatedAt: '2099-05-01T00:00:00Z',
}
function setup(data: unknown, status = 200) {
  const calls: { url: string; body: Record<string, unknown> }[] = []
  const client = createClient(
    'https://synthetic.supabase.co',
    'synthetic-test-key',
    {
      global: {
        fetch: async (input, init) => {
          calls.push({
            url: String(input),
            body: JSON.parse(String(init?.body)),
          })
          return new Response(JSON.stringify(data), {
            status,
            headers: { 'Content-Type': 'application/json' },
          })
        },
      },
    },
  )
  return { repository: new SupabaseCalendarRepository(() => client), calls }
}
describe('calendar repository security boundary', () => {
  it('reads safe occurrences and strips unexpected credential fields', async () => {
    const occurrence = {
      event,
      owner,
      date: '2099-05-04',
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      note: null,
      cancelled: false,
      isException: false,
    }
    const s = setup({
      members: [{ ...owner, pin_hash: 'private' }],
      occurrences: [{ ...occurrence, session: 'private' }],
    })
    const result = await s.repository.list(id, '2099-05-04', '2099-05-10', null)
    expect(result).toEqual({ members: [owner], occurrences: [occurrence] })
    expect(s.calls[0]!.body).toEqual({
      p_actor_member_id: id,
      p_from: '2099-05-04',
      p_to: '2099-05-10',
      p_owner_member_id: null,
      p_calendar_type: 'FAMILY',
    })
  })
  it('sends authenticated actor and immutable occurrence identity to exception RPC', async () => {
    const s = setup(null)
    await s.repository.exception(id, id, '2099-05-04', {
      cancelled: true,
      title: null,
      startsAt: null,
      endsAt: null,
      note: null,
    })
    expect(s.calls[0]!.url).toContain('/rpc/calendar_save_exception')
    expect(s.calls[0]!.body).toEqual({
      p_actor_member_id: id,
      p_event_id: id,
      p_occurrence_date: '2099-05-04',
      p_cancelled: true,
      p_title: null,
      p_starts_at: null,
      p_ends_at: null,
      p_note: null,
    })
  })
  it.each(['PARENT', 'ADMIN', 'MEMBER'])(
    'propagates database owner denial for %s without leaking details',
    async () => {
      const s = setup(
        { code: '42501', message: 'private storage details' },
        403,
      )
      await expect(s.repository.remove(id, id)).rejects.toMatchObject({
        status: 403,
        code: 'CALENDAR_FORBIDDEN',
        message: 'Only the active owner can change this calendar event',
      })
    },
  )
  it('uses the owner-checked save RPC for new and existing events', async () => {
    const s = setup(id)
    await expect(s.repository.save(id, null, event)).resolves.toBe(id)
    await expect(s.repository.save(id, id, event)).resolves.toBe(id)
    expect(s.calls.map((c) => c.body.p_actor_member_id)).toEqual([id, id])
    expect(s.calls.map((c) => c.body.p_event_id)).toEqual([null, id])
  })
  it.each([{}, { members: [owner], occurrences: [null] }])(
    'refuses malformed storage results',
    async (data) => {
      await expect(
        setup(data).repository.list(id, '2099-05-04', '2099-05-10', null),
      ).rejects.toThrow()
    },
  )
})
