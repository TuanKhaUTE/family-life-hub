import { expect, it } from 'vitest'
import {
  FamilyFoodService,
  normalizeFood,
  type FamilyFoodRepository,
} from '../src/services/family-food.service.js'

const parent = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'PARENT' as const,
  displayName: 'Synthetic Parent',
  avatarType: null,
  avatarValue: null,
}

it('normalizes a standalone grocery amount without requiring a meal slot', () => {
  expect(
    normalizeFood(
      {
        mealDate: '2026-10-22',
        category: 'GROCERIES',
        amount: '350000',
        note: ' Thịt, rau, trứng ',
      },
      '2026-10-22',
    ),
  ).toEqual({
    mealDate: '2026-10-22',
    category: 'GROCERIES',
    amount: '350000',
    note: 'Thịt, rau, trứng',
  })
})

it('rejects a zero or future grocery amount', () => {
  expect(() =>
    normalizeFood(
      { mealDate: '2026-10-22', category: 'GROCERIES', amount: '0' },
      '2026-10-22',
    ),
  ).toThrow()
  expect(() =>
    normalizeFood(
      { mealDate: '2026-10-23', category: 'GROCERIES', amount: '1' },
      '2026-10-22',
    ),
  ).toThrow()
})

it('returns exact category and trend summaries from shared food data', async () => {
  const repository: FamilyFoodRepository = {
    read: async () => ({
      expenses: [],
      totalCount: 0,
      currentTotal: '470000',
      previousTotal: '200000',
      breakfastTotal: '120000',
      dinnerTotal: '0',
      groceriesTotal: '350000',
      categories: [
        { category: 'BREAKFAST', amount: '120000' },
        { category: 'DINNER', amount: '0' },
        { category: 'GROCERIES', amount: '350000' },
      ],
      dailyTrend: [{ date: '2026-10-22', amount: '350000' }],
      monthlyTrend: [{ month: '2026-10', amount: '470000' }],
    }),
    slot: async () => null,
    mutate: async () => undefined,
  }
  await expect(new FamilyFoodService(repository).read(parent, '2026-10')).resolves.toMatchObject({
    summary: {
      currentTotal: '470000',
      differenceAmount: '270000',
      percentageChange: 135,
      groceriesTotal: '350000',
      categories: expect.any(Array),
      dailyTrend: expect.any(Array),
      monthlyTrend: expect.any(Array),
    },
  })
})

it('allows PARENT grocery mutation but keeps ADMIN read-only', async () => {
  const mutate = async () => undefined
  const repository: FamilyFoodRepository = {
    read: async () => ({
      expenses: [], totalCount: 0, currentTotal: '0', previousTotal: '0',
      breakfastTotal: '0', dinnerTotal: '0', groceriesTotal: '0',
      categories: [], dailyTrend: [], monthlyTrend: [],
    }),
    slot: async () => null,
    mutate,
  }
  const service = new FamilyFoodService(repository, undefined, () => new Date('2026-10-22T05:00:00Z'))
  await expect(service.save(parent, null, {
    mealDate: '2026-10-22', category: 'GROCERIES', amount: '350000', note: null,
  })).resolves.toBeUndefined()
  await expect(service.save({ ...parent, role: 'ADMIN' }, null, {
    mealDate: '2026-10-22', category: 'GROCERIES', amount: '1', note: null,
  })).rejects.toMatchObject({ status: 403 })
})
