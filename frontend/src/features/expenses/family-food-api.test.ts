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
const zeroView = {
  ...view,
  totalCount: 0,
  hasMore: false,
  expenses: [],
  summary: {
    ...view.summary,
    currentTotal: '0',
    previousTotal: '0',
    differenceAmount: '0',
    percentageChange: null,
    breakfastTotal: '0',
    dinnerTotal: '0',
    groceriesTotal: '0',
    categories: [
      { category: 'BREAKFAST' as const, amount: '0' },
      { category: 'DINNER' as const, amount: '0' },
      { category: 'GROCERIES' as const, amount: '0' },
    ],
    dailyTrend: Array.from({ length: 31 }, (_, index) => ({
      date: `2026-10-${String(index + 1).padStart(2, '0')}`,
      amount: '0',
    })),
    monthlyTrend: Array.from({ length: 6 }, (_, index) => ({
      month: `2026-${String(index + 5).padStart(2, '0')}`,
      amount: '0',
    })),
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
it('parses grocery records without a mealType and exact category/day/month totals', async () => {
  const f = vi.fn(async () =>
    new Response(
      JSON.stringify({
        familyFood: {
          ...view,
          expenses: [
            {
              id: expense.id,
              mealDate: expense.mealDate,
              category: 'GROCERIES',
              amount: '420000',
              note: 'Thịt, rau, trứng',
              total: '420000',
            },
          ],
          summary: {
            ...view.summary,
            currentTotal: '420000',
            previousTotal: '0',
            differenceAmount: '420000',
            groceriesTotal: '420000',
            breakfastTotal: '0',
            dinnerTotal: '0',
            categories: [
              { category: 'BREAKFAST', amount: '0' },
              { category: 'DINNER', amount: '0' },
              { category: 'GROCERIES', amount: '420000' },
            ],
            dailyTrend: [{ date: expense.mealDate, amount: '420000' }],
            monthlyTrend: [{ month: '2026-10', amount: '420000' }],
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
    total: '420000',
  })
  expect(result.summary.categories?.[2]).toEqual({
    category: 'GROCERIES',
    amount: '420000',
  })
  expect(result.summary.dailyTrend).toEqual([
    { date: expense.mealDate, amount: '420000' },
  ])
})
it('accepts null mealType for GROCERIES but rejects a meal type string', async () => {
  const grocery = {
    id: expense.id,
    mealDate: '2026-11-09',
    category: 'GROCERIES',
    amount: '420000',
    note: null,
    total: '420000',
  }
  const summary = {
    ...view.summary,
    currentTotal: '420000',
    differenceAmount: '420000',
    groceriesTotal: '420000',
    breakfastTotal: '0',
    dinnerTotal: '0',
    categories: [
      { category: 'BREAKFAST' as const, amount: '0' },
      { category: 'DINNER' as const, amount: '0' },
      { category: 'GROCERIES' as const, amount: '420000' },
    ],
    dailyTrend: [{ date: grocery.mealDate, amount: '420000' }],
    monthlyTrend: [{ month: '2026-11', amount: '420000' }],
  }
  const makeResponse = (mealType: null | 'DINNER') => ({
    familyFood: {
      ...view,
      month: '2026-11',
      expenses: [{ ...grocery, mealType }],
      summary: { ...summary, previousMonth: '2026-10' },
    },
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(makeResponse(null)))),
  )
  await expect(fetchFood('2026-11', 1, new AbortController().signal)).resolves.toMatchObject({
    expenses: [{ category: 'GROCERIES', mealType: null, total: '420000' }],
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(makeResponse('DINNER')))),
  )
  await expect(
    fetchFood('2026-11', 1, new AbortController().signal),
  ).rejects.toThrow('Invalid grocery expense')
})
it('accepts the canonical empty family-food workspace without FOOD_UNAVAILABLE', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({ familyFood: zeroView })),
    ),
  )
  await expect(fetchFood('2026-10', 1, new AbortController().signal)).resolves.toMatchObject({
    month: '2026-10',
    totalCount: 0,
    expenses: [],
    summary: expect.objectContaining({
      currentTotal: '0',
      previousTotal: '0',
      groceriesTotal: '0',
      categories: zeroView.summary.categories,
      dailyTrend: zeroView.summary.dailyTrend,
      monthlyTrend: zeroView.summary.monthlyTrend,
    }),
  })
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
