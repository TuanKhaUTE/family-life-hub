import { createClient } from '@supabase/supabase-js'
import { expect, it } from 'vitest'
import { SupabaseWellnessRepository } from '../src/repositories/wellness.repository.js'
const id = '11111111-1111-4111-8111-111111111111'
function setup(body: unknown, status = 200) {
  const calls: { url: string; body: unknown }[] = []
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
  return { repository: new SupabaseWellnessRepository(() => client), calls }
}
const data = {
  profile: { heightCm: 174, targetWeightKg: 64, activityLevel: 'LIGHT' },
  logs: [{ id, loggedDate: '2026-10-22', weightKg: 62.5, note: null }],
}
it('scopes RPC reads to actor and strips unexpected credential/owner fields', async () => {
  const s = setup({
    profile: { ...data.profile, pin_hash: 'private' },
    logs: [{ ...data.logs[0], owner_member_id: 'private' }],
  })
  expect(await s.repository.read(id, '2026-10-22')).toEqual(data)
  expect(s.calls[0]).toMatchObject({
    body: { p_actor_member_id: id, p_today: '2026-10-22' },
  })
})
it('passes authenticated identity separately from editable profile fields', async () => {
  const s = setup(null)
  await s.repository.mutate(id, 'profile', null, null, true)
  expect(s.calls[0]!.url).toContain('/rpc/wellness_mutate')
  expect(s.calls[0]!.body).toEqual({
    p_actor_member_id: id,
    p_kind: 'profile',
    p_id: null,
    p_input: null,
    p_remove: true,
  })
})
it.each([
  ['42501', 403],
  ['P0002', 404],
  ['23505', 409],
  ['23514', 400],
] as const)('maps %s without exposing SQL details', async (code, status) => {
  const s = setup({ code, message: 'private database detail' }, 400)
  await expect(s.repository.read(id, '2026-10-22')).rejects.toMatchObject({
    status,
  })
  await expect(
    s.repository.mutate(id, 'logs', id, null, true),
  ).rejects.not.toThrow('private database detail')
})
it.each([
  {},
  { ...data, logs: [{ ...data.logs[0], weightKg: '62.5' }] },
  { ...data, logs: [data.logs[0], data.logs[0]] },
  { ...data, profile: { heightCm: 500 } },
])('fails safely on malformed stored measurements', async (body) => {
  await expect(setup(body).repository.read(id, '2026-10-22')).rejects.toThrow(
    'Invalid Wellness storage response',
  )
})
