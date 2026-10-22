import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { SupabaseChoreRepository } from '../src/repositories/chore.repository.js'
const id = '11111111-1111-4111-8111-111111111111'
const schedule = {
  id,
  requestId: id,
  title: 'Synthetic chore',
  category: 'DISHES' as const,
  scheduledDate: '2099-05-04',
  scheduledTime: null,
  assignedMemberId: id,
  weeklyAssignments: [],
  recurrenceUntil: null,
  note: null,
  createdByMemberId: id,
  cancelled: false,
  createdAt: '2099-05-04T00:00:00Z',
  updatedAt: '2099-05-04T00:00:00Z',
}
const assignee = {
  id,
  displayName: 'Synthetic Member',
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
  return { repository: new SupabaseChoreRepository(() => client), calls }
}
describe('chore repository', () => {
  it('projects safe family chores without credential fields', async () => {
    const s = setup({
      members: [{ ...assignee, pin_hash: 'private' }],
      chores: [
        {
          schedule: { ...schedule, session: 'private' },
          date: schedule.scheduledDate,
          assignee,
          status: 'COMPLETED',
          completedAt: '2099-05-04T12:00:00Z',
          completedByMemberId: id,
        },
      ],
    })
    const result = await s.repository.list(
      id,
      schedule.scheduledDate,
      schedule.scheduledDate,
      null,
    )
    expect(result.members).toEqual([assignee])
    expect(JSON.stringify(result)).not.toMatch(/pin_hash|session/)
    expect(result.chores[0]).toMatchObject({
      status: 'COMPLETED',
      completedByMemberId: id,
    })
    expect(s.calls[0]!.body).toEqual({
      p_actor_member_id: id,
      p_from: schedule.scheduledDate,
      p_to: schedule.scheduledDate,
      p_member_id: null,
    })
  })
  it('uses authenticated actor for atomic schedule/notification save', async () => {
    const s = setup(id)
    await expect(s.repository.save(id, null, schedule)).resolves.toBe(id)
    expect(s.calls[0]!.url).toContain('/rpc/chore_save')
    expect(s.calls[0]!.body).toMatchObject({
      p_actor_member_id: id,
      p_schedule_id: null,
      p_input: { requestId: id },
    })
  })
  it('keeps completion and cancellation as separate owner/role-checked RPC actions', async () => {
    const s = setup(null)
    await s.repository.complete(id, id, '2099-05-04')
    await s.repository.cancelOccurrence(id, id, '2099-05-04')
    await s.repository.cancelSchedule(id, id)
    expect(s.calls.map((c) => c.body.p_action)).toEqual([
      'COMPLETE',
      'CANCEL',
      undefined,
    ])
    expect(s.calls.every((c) => c.body.p_actor_member_id === id)).toBe(true)
  })
  it.each([
    ['42501', 403, 'CHORE_FORBIDDEN'],
    ['P4001', 409, 'CHORE_CONFLICT'],
    ['22023', 400, 'CHORE_INVALID'],
  ] as const)(
    'maps %s without leaking storage detail',
    async (code, status, errorCode) => {
      const s = setup({ code, message: 'private storage detail' }, 400)
      await expect(
        s.repository.complete(id, id, '2099-05-04'),
      ).rejects.toMatchObject({ status, code: errorCode })
      await expect(s.repository.cancelSchedule(id, id)).rejects.not.toThrow(
        'private storage detail',
      )
    },
  )
  it.each([
    {},
    {
      members: [],
      chores: [
        {
          schedule,
          date: '2099-05-04',
          assignee,
          status: 'COMPLETED',
          completedAt: null,
          completedByMemberId: null,
        },
      ],
    },
  ])('rejects malformed completion metadata', async (data) => {
    await expect(
      setup(data).repository.list(id, '2099-05-04', '2099-05-04', null),
    ).rejects.toThrow()
  })
})
