import { createClient } from '@supabase/supabase-js'
import { expect, it } from 'vitest'
import { SupabasePersonalExpenseRepository } from '../src/repositories/personal-expense.repository.js'
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
  return {
    repository: new SupabasePersonalExpenseRepository(() => client),
    calls,
  }
}
const body = {
  expenses: [
    {
      id,
      amount: '120000',
      spentOn: '2026-10-22',
      category: 'TRANSPORT',
      note: null,
    },
  ],
  totalCount: 1,
  currentTotal: '120000',
  previousTotal: '9007199254740993',
  categories: [{ category: 'TRANSPORT', amount: '120000' }],
}
it('uses the authenticated owner for monthly RPC reads and strips private extras', async () => {
  const s = setup({
    ...body,
    secret: 'private',
    expenses: [
      { ...body.expenses[0], owner_member_id: 'private', pin_hash: 'private' },
    ],
  })
  expect(await s.repository.read(id, '2026-10', 1)).toEqual(body)
  expect(s.calls[0]!.body).toEqual({
    p_actor_member_id: id,
    p_month: '2026-10-01',
    p_page: 1,
  })
})
it('keeps actor identity outside editable mutation JSON', async () => {
  const s = setup(null)
  await s.repository.mutate(id, id, null, true)
  expect(s.calls[0]!.url).toContain('/rpc/personal_expense_mutate')
  expect(s.calls[0]!.body).toEqual({
    p_actor_member_id: id,
    p_id: id,
    p_input: null,
    p_remove: true,
  })
})
it.each([
  ['42501', 403],
  ['P0002', 404],
  ['23514', 400],
] as const)('maps %s safely', async (code, status) => {
  const s = setup({ code, message: 'private SQL detail' }, 400)
  await expect(s.repository.read(id, '2026-10', 1)).rejects.toMatchObject({
    status,
  })
  await expect(s.repository.mutate(id, id, null, true)).rejects.not.toThrow(
    'private SQL detail',
  )
})
it.each([
  {},
  { ...body, currentTotal: 120000 },
  { ...body, expenses: [{ ...body.expenses[0], amount: '1.5' }] },
  { ...body, categories: [{ category: 'OTHER', amount: '1' }] },
])('rejects malformed or contradictory money data', async (value) => {
  await expect(setup(value).repository.read(id, '2026-10', 1)).rejects.toThrow(
    'Invalid personal expense storage response',
  )
})
