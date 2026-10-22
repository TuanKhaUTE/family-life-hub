import { afterEach, expect, it, vi } from 'vitest'
import {
  fetchPersonalExpenses,
  savePersonalExpense,
  deletePersonalExpense,
  expenseError,
} from './expense-api'
import { formatVnd, expenseComparisonText } from './expense-display'
const id = '11111111-1111-4111-8111-111111111111'
const summary = {
  currentTotal: '120000',
  previousMonth: '2026-09',
  previousTotal: '100000',
  differenceAmount: '20000',
  percentageChange: 20,
  categories: [{ category: 'TRANSPORT', amount: '120000' }],
}
const data = {
  month: '2026-10',
  currency: 'VND',
  page: 1,
  totalCount: 1,
  hasMore: false,
  expenses: [
    {
      id,
      amount: '120000',
      spentOn: '2026-10-22',
      category: 'TRANSPORT',
      note: null,
    },
  ],
  summary,
}
afterEach(() => vi.unstubAllGlobals())
it('reads actor-scoped month data through Express and reconstructs safe fields', async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        personalExpenses: {
          ...data,
          secret: 'private',
          expenses: [{ ...data.expenses[0], owner_member_id: 'private' }],
        },
      }),
    ),
  )
  vi.stubGlobal('fetch', fetch)
  const signal = new AbortController().signal
  expect(await fetchPersonalExpenses('2026-10', 1, signal)).toEqual(data)
  expect(fetch.mock.calls[0][0]).toBe(
    '/api/expenses/personal?month=2026-10&page=1',
  )
  expect(fetch.mock.calls[0][1]).toMatchObject({
    credentials: 'same-origin',
    signal,
  })
})
it.each([
  {},
  { personalExpenses: { ...data, currency: 'USD' } },
  {
    personalExpenses: {
      ...data,
      summary: { ...summary, currentTotal: 120000 },
    },
  },
  {
    personalExpenses: {
      ...data,
      summary: { ...summary, percentageChange: Infinity },
    },
  },
  {
    personalExpenses: {
      ...data,
      expenses: [{ ...data.expenses[0], amount: '1.5' }],
    },
  },
  {
    personalExpenses: {
      ...data,
      summary: { ...summary, categories: [{ category: 'OTHER', amount: '1' }] },
    },
  },
])('rejects unsafe or contradictory money data', async (body) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body))),
  )
  await expect(
    fetchPersonalExpenses('2026-10', 1, new AbortController().signal),
  ).rejects.toThrow()
})
it('preserves mutation identity and does not send ownership authority', async () => {
  const fetch = vi
    .fn()
    .mockImplementation(async () => new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)
  await savePersonalExpense(null, {
    amount: '120000',
    spentOn: '2026-10-22',
    category: 'TRANSPORT',
    note: null,
  })
  await savePersonalExpense(id, {
    amount: '130000',
    spentOn: '2026-10-22',
    category: 'OTHER',
    note: null,
  })
  await deletePersonalExpense(id)
  expect(fetch.mock.calls.map((c) => [c[0], c[1].method])).toEqual([
    ['/api/expenses/personal', 'POST'],
    [`/api/expenses/personal/${id}`, 'PUT'],
    [`/api/expenses/personal/${id}`, 'DELETE'],
  ])
  expect(JSON.stringify(fetch.mock.calls)).not.toMatch(
    /owner_member_id|ownerMemberId/,
  )
})
it('formats VND exactly above JS safe integer range and avoids invalid zero-base percentages', () => {
  expect(formatVnd('120000')).toBe('120.000 đ')
  expect(formatVnd('9007199254740993')).toBe('9.007.199.254.740.993 đ')
  expect(
    expenseComparisonText({
      previousTotal: '0',
      differenceAmount: '120000',
      percentageChange: null,
    }),
  ).toContain('chưa tính tỷ lệ')
  expect(
    expenseComparisonText({
      previousTotal: '1250000',
      differenceAmount: '-250000',
      percentageChange: -20,
    }),
  ).toBe('Giảm 250.000 đ · 20%')
  expect(expenseError(new Error('private detail'))).not.toContain('private')
})
