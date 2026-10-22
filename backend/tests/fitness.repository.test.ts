import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { SupabaseFitnessRepository } from '../src/repositories/fitness.repository.js'
const id = '11111111-1111-4111-8111-111111111111'
function setup(body: unknown, status = 200) {
  const calls: { url: string; body: Record<string, unknown> }[] = []
  const client = createClient(
    'https://synthetic.supabase.co',
    'synthetic-test-key',
    {
      global: {
        fetch: async (url, init) => {
          calls.push({ url: String(url), body: JSON.parse(String(init?.body)) })
          return new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
          })
        },
      },
    },
  )
  return { repository: new SupabaseFitnessRepository(() => client), calls }
}
const summary = {
  weekStart: '2026-10-19',
  weekEnd: '2026-10-25',
  sessionsThisWeek: 2,
  weeklyTarget: 3,
  completionPercent: 67,
  totalMinutes: 115,
  unrecordedDurationCount: 0,
  nextWorkout: {
    planDayId: id,
    title: 'Synthetic next',
    date: '2026-10-23',
    weekday: 5,
  },
}
describe('Fitness repository boundary', () => {
  it('passes the authenticated owner and strips unexpected profile/credential data', async () => {
    const s = setup({
      plans: [
        {
          id,
          name: 'Synthetic plan',
          note: null,
          isActive: true,
          owner_member_id: 'private',
          pin_hash: 'private',
        },
      ],
      days: [],
      goals: [],
      sessions: [],
      summary: { ...summary, secret: 'private' },
    })
    const data = await s.repository.read(id, '2026-10-22')
    expect(s.calls[0]!.body).toEqual({
      p_actor_member_id: id,
      p_today: '2026-10-22',
    })
    expect(data.summary).toEqual(summary)
    expect(JSON.stringify(data)).not.toMatch(/owner_member_id|pin_hash|private/)
  })
  it('uses the atomic owner-scoped mutation RPC', async () => {
    const s = setup(null)
    await s.repository.mutate(id, 'sessions', id, null, true)
    expect(s.calls[0]!.url).toContain('/rpc/fitness_mutate')
    expect(s.calls[0]!.body).toEqual({
      p_actor_member_id: id,
      p_kind: 'sessions',
      p_id: id,
      p_input: null,
      p_remove: true,
    })
  })
  it.each([
    ['42501', 403],
    ['P0002', 404],
    ['23503', 409],
    ['23505', 409],
    ['23514', 400],
  ] as const)('maps %s safely', async (code, status) => {
    const s = setup({ code, message: 'private storage detail' }, 400)
    await expect(s.repository.read(id, '2026-10-22')).rejects.toMatchObject({
      status,
    })
    await expect(
      s.repository.mutate(id, 'plans', id, null, true),
    ).rejects.not.toThrow('private storage detail')
  })
  it.each([
    {},
    {
      plans: [],
      days: [],
      goals: [],
      sessions: [],
      summary: { ...summary, completionPercent: 101 },
    },
  ])('rejects malformed summary data', async (data) => {
    await expect(
      setup(data).repository.read(id, '2026-10-22'),
    ).rejects.toThrow()
  })
})
