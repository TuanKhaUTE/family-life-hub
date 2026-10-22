import { afterEach, expect, it, vi } from 'vitest'
import {
  fetchFood,
  fetchFoodSlot,
  prefillFood,
  saveFood,
} from './family-food-api'
const expense = {
  id: '11111111-1111-4111-8111-111111111111',
  mealDate: '2026-10-22',
  mealType: 'DINNER',
  category: 'DINNER',
  note: null,
  items: [{ name: 'Synthetic dish', amount: '170000' }],
  total: '170000',
}
const view = {
  month: '2026-10',
  currency: 'VND',
  page: 1,
  totalCount: 1,
  hasMore: false,
  expenses: [expense],
  summary: {
    currentTotal: '170000',
    previousMonth: '2026-09',
    previousTotal: '0',
    differenceAmount: '170000',
    percentageChange: null,
    breakfastTotal: '0',
    dinnerTotal: '170000',
  },
}
afterEach(() => vi.unstubAllGlobals())
it('uses session REST only and projects item snapshots without private metadata', async () => {
  const f = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          familyFood: {
            ...view,
            secret: 'omit',
            expenses: [{ ...expense, created_by_member_id: 'omit' }],
          },
        }),
      ),
  )
  vi.stubGlobal('fetch', f)
  const signal = new AbortController().signal
  expect(await fetchFood('2026-10', 1, signal)).toEqual(view)
  expect(f).toHaveBeenCalledWith(
    '/api/expenses/family-food?month=2026-10&page=1',
    expect.objectContaining({ credentials: 'same-origin', signal }),
  )
})
it('parses grocery records and exact category/day/month trend totals', async () => {
  const f = vi.fn(async () =>
    new Response(
      JSON.stringify({
        familyFood: {
          ...view,
          expenses: [
            {
              id: expense.id,
              mealDate: expense.mealDate,
              mealType: null,
              category: 'GROCERIES',
              amount: '350000',
              note: 'Thịt, rau, trứng',
              total: '350000',
            },
          ],
          summary: {
            ...view.summary,
            currentTotal: '350000',
            previousTotal: '0',
            differenceAmount: '350000',
            groceriesTotal: '350000',
            breakfastTotal: '0',
            dinnerTotal: '0',
            categories: [
              { category: 'BREAKFAST', amount: '0' },
              { category: 'DINNER', amount: '0' },
              { category: 'GROCERIES', amount: '350000' },
            ],
            dailyTrend: [{ date: expense.mealDate, amount: '350000' }],
            monthlyTrend: [{ month: '2026-10', amount: '350000' }],
          },
        },
      }),
    ),
  )
  vi.stubGlobal('fetch', f)
  const result = await fetchFood('2026-10', 1, new AbortController().signal)
  expect(result.expenses[0]).toMatchObject({
    category: 'GROCERIES',
    mealType: null,
    total: '350000',
  })
  expect(result.summary.categories?.[2]).toEqual({
    category: 'GROCERIES',
    amount: '350000',
  })
  expect(result.summary.dailyTrend).toEqual([
    { date: expense.mealDate, amount: '350000' },
  ])
})
it.each([
  { ...view, summary: { ...view.summary, currentTotal: '170001' } },
  { ...view, summary: { ...view.summary, breakfastTotal: '1' } },
  { ...view, expenses: [{ ...expense, total: '170001' }] },
  { ...view, expenses: [{ ...expense, mealType: 'LUNCH' }] },
  { ...view, expenses: [{ ...expense, items: [] }] },
  {
    ...view,
    expenses: [
      { ...expense, items: [{ name: 'Synthetic dish', amount: '1.5' }] },
    ],
  },
  { ...view, month: '2026-09' },
  { ...view, hasMore: true },
])(
  'rejects contradictory or invalid money/meal data %#',
  async (familyFood) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ familyFood }))),
    )
    await expect(
      fetchFood('2026-10', 1, new AbortController().signal),
    ).rejects.toThrow()
  },
)
it('slot reads reject the wrong date/type instead of attaching costs to another meal', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ expense }))),
  )
  await expect(
    fetchFoodSlot('2026-10-21', 'DINNER', new AbortController().signal),
  ).rejects.toThrow('Invalid food slot')
})
it('bounded meal assistance returns names without prices', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () => new Response(JSON.stringify({ names: ['Synthetic dinner'] })),
    ),
  )
  expect(await prefillFood('2026-10-22', 'DINNER')).toEqual([
    'Synthetic dinner',
  ])
})
it('safe mutation errors never echo SQL/private payloads', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: { code: 'FOOD_FORBIDDEN', message: 'SQL private' },
          }),
          { status: 403 },
        ),
    ),
  )
  await expect(
    saveFood(null, {
      mealDate: '2026-10-22',
      mealType: 'DINNER',
      note: null,
      items: expense.items,
    }),
  ).rejects.toMatchObject({
    code: 'FOOD_FORBIDDEN',
    message: 'Family food unavailable',
  })
})
