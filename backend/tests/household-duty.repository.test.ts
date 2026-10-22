import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { SupabaseHouseholdDutyRepository } from '../src/repositories/household-duty.repository.js'
const id = '11111111-1111-4111-8111-111111111111'
const member = {
  id,
  displayName: 'Synthetic Duty Member',
  avatarType: null,
  avatarValue: null,
}
function setup(data: unknown, status = 200) {
  const calls: { url: string; body: Record<string, unknown> }[] = []
  const client = createClient(
    'https://synthetic.supabase.co',
    'synthetic-test-key',
    {
      global: {
        fetch: async (url, init) => {
          calls.push({ url: String(url), body: JSON.parse(String(init?.body)) })
          return new Response(JSON.stringify(data), {
            status,
            headers: { 'Content-Type': 'application/json' },
          })
        },
      },
    },
  )
  return {
    repository: new SupabaseHouseholdDutyRepository(() => client),
    calls,
  }
}
describe('household duty repository boundary', () => {
  it('projects safe profiles and completion metadata', async () => {
    const duty = {
      id,
      date: '2099-05-04',
      assignee: member,
      cancelled: false,
      completedAt: null,
      completedByMemberId: null,
    }
    const s = setup({
      members: [{ ...member, pin_hash: 'private' }],
      duties: [{ ...duty, created_by_member_id: 'private' }],
    })
    expect(await s.repository.list(id, '2099-05-04', '2099-05-04')).toEqual({
      members: [member],
      duties: [duty],
    })
    expect(s.calls[0]!.body).toEqual({
      p_actor_member_id: id,
      p_from: '2099-05-04',
      p_to: '2099-05-04',
    })
  })
  it('uses explicit actor and no client ownership for all writes', async () => {
    const s = setup(null)
    await s.repository.saveWeek(id, [{ date: '2099-05-04', memberId: id }])
    await s.repository.complete(id, '2099-05-04')
    await s.repository.cancel(id, '2099-05-04')
    expect(s.calls.map((c) => c.url.split('/').at(-1))).toEqual([
      'household_duty_save_week',
      'household_duty_action',
      'household_duty_action',
    ])
    expect(s.calls[1]!.body).toEqual({
      p_actor_member_id: id,
      p_date: '2099-05-04',
      p_action: 'COMPLETE',
    })
    expect(s.calls[2]!.body.p_action).toBe('CANCEL')
  })
  it('validates week-copy result and sends only actor/source week', async () => {
    const s = setup(2)
    expect(await s.repository.duplicateWeek(id, '2099-05-04')).toBe(2)
    expect(s.calls[0]!.body).toEqual({
      p_actor_member_id: id,
      p_source_week: '2099-05-04',
    })
    await expect(
      setup(-1).repository.duplicateWeek(id, '2099-05-04'),
    ).rejects.toThrow('Invalid duty copy result')
  })
  it.each([
    ['42501', 403],
    ['P4001', 409],
    ['P0002', 404],
    ['23503', 400],
  ] as const)('maps %s safely', async (code, status) => {
    const s = setup({ code, message: 'private database details' }, 400)
    await expect(s.repository.complete(id, '2099-05-04')).rejects.toMatchObject(
      { status },
    )
    await expect(s.repository.complete(id, '2099-05-04')).rejects.not.toThrow(
      /private database/,
    )
  })
  it('rejects malformed completion rows', async () => {
    const s = setup({
      members: [],
      duties: [
        {
          id,
          date: 'bad',
          assignee: member,
          cancelled: false,
          completedAt: 'bad',
        },
      ],
    })
    await expect(
      s.repository.list(id, '2099-05-04', '2099-05-04'),
    ).rejects.toThrow('Invalid duty')
  })
})
