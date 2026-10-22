import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { SupabaseStudyRepository } from '../src/repositories/study.repository.js'
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
  return { repository: new SupabaseStudyRepository(() => client), calls }
}
describe('Study repository privacy boundary', () => {
  it('requests only the session actor and strips unexpected private fields', async () => {
    const s = setup({
      semesters: [
        {
          id,
          name: 'Synthetic',
          startDate: '2026-01-01',
          endDate: '2027-12-31',
          isActive: true,
          owner_member_id: 'private',
          pin_hash: 'private',
        },
      ],
      courses: [],
      goals: [],
      sessions: [],
      summary: {
        weekStart: '2026-10-19',
        weekEnd: '2026-10-25',
        totalMinutes: 0,
        sessionCount: 0,
        goals: [],
        courses: [],
        secret: 'private',
      },
    })
    const result = await s.repository.read(id, '2026-10-22')
    expect(s.calls[0]!.body).toEqual({
      p_actor_member_id: id,
      p_today: '2026-10-22',
    })
    expect(JSON.stringify(result)).not.toMatch(
      /owner_member_id|pin_hash|private/,
    )
  })
  it.each([
    ['42501', 403],
    ['P0002', 404],
    ['23503', 409],
    ['23514', 400],
  ] as const)('maps %s to safe HTTP %s', async (code, status) => {
    const s = setup({ code, message: 'private database detail' }, 400)
    await expect(
      s.repository.mutate(id, 'sessions', id, null, true),
    ).rejects.toMatchObject({ status })
    await expect(s.repository.read(id, '2026-10-22')).rejects.not.toThrow(
      'private database detail',
    )
  })
  it('rejects malformed read data rather than forwarding it', async () => {
    await expect(
      setup({ summary: {} }).repository.read(id, '2026-10-22'),
    ).rejects.toThrow()
  })
})
