import request from 'supertest'
import express from 'express'
import { expect, it, vi } from 'vitest'
import {
  FamilyFoodService,
  type FamilyFoodRepository,
} from '../src/services/family-food.service.js'
import { createFamilyFoodRouter } from '../src/routes/family-food.routes.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import app from '../src/app.js'
import { SupabaseFamilyFoodRepository } from '../src/repositories/family-food.repository.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FinalMealService } from '../src/services/final-meal.service.js'
import type { BreakfastService } from '../src/services/breakfast.service.js'
import type { FamilySessionOperations } from '../src/services/family-session.service.js'
import type { SafeFamilyProfile } from '../src/services/family-auth.service.js'

const id = '11111111-1111-4111-8111-111111111111'
const input = {
  mealDate: '2026-10-22',
  mealType: 'DINNER',
  note: null,
  items: [
    { name: ' Synthetic dish ', amount: '100000' },
    { name: 'Soup', amount: '70000' },
  ],
}
function setup(role: SafeFamilyProfile['role'] = 'PARENT') {
  const actor = {
    id,
    role,
    displayName: 'Synthetic Food',
    avatarType: null,
    avatarValue: null,
  }
  const repository: FamilyFoodRepository = {
    read: vi.fn(async () => ({
      expenses: [],
      totalCount: 0,
      currentTotal: '290000',
      previousTotal: '200000',
      breakfastTotal: '120000',
      dinnerTotal: '170000',
      groceriesTotal: '0',
      categories: [
        { category: 'BREAKFAST', amount: '120000' },
        { category: 'DINNER', amount: '170000' },
        { category: 'GROCERIES', amount: '0' },
      ],
      dailyTrend: [],
      monthlyTrend: [],
    })),
    slot: vi.fn(async () => null),
    mutate: vi.fn(async () => {}),
  }
  const service = new FamilyFoodService(
    repository,
    undefined,
    () => new Date('2026-10-22T05:00:00Z'),
  )
  const sessions = {
    authenticate: async () => ({ sessionId: 'synthetic', profile: actor }),
  } as unknown as FamilySessionOperations
  const app = express()
    .use(express.json())
    .use('/food', createFamilyFoodRouter(service, sessions))
    .use(errorHandler)
  return { service, repository, actor, app }
}
it.each(['PARENT', 'ADMIN', 'MEMBER'] as const)(
  '%s reads shared totals without personal records',
  async (role) => {
    const s = setup(role),
      res = await request(s.app).get('/food')
    expect(res.status).toBe(200)
    expect(res.body.familyFood.summary).toEqual({
      currentTotal: '290000',
      previousTotal: '200000',
      breakfastTotal: '120000',
      dinnerTotal: '170000',
      groceriesTotal: '0',
      categories: [
        { category: 'BREAKFAST', amount: '120000' },
        { category: 'DINNER', amount: '170000' },
        { category: 'GROCERIES', amount: '0' },
      ],
      dailyTrend: [],
      monthlyTrend: [],
      previousMonth: '2026-09',
      differenceAmount: '90000',
      percentageChange: 45,
    })
    expect(res.headers['cache-control']).toBe('no-store')
    expect(s.repository.read).toHaveBeenCalledWith(id, '2026-10', 1)
  },
)
it('PARENT creates, edits and deletes itemized meals with normalized inputs', async () => {
  const s = setup()
  expect((await request(s.app).post('/food').send(input)).status).toBe(204)
  expect(
    (
      await request(s.app)
        .put('/food/' + id)
        .send(input)
    ).status,
  ).toBe(204)
  expect((await request(s.app).delete('/food/' + id)).status).toBe(204)
  expect(vi.mocked(s.repository.mutate).mock.calls).toEqual([
    [
      id,
      null,
      {
        ...input,
        items: [
          { name: 'Synthetic dish', amount: '100000' },
          { name: 'Soup', amount: '70000' },
        ],
      },
      false,
    ],
    [
      id,
      id,
      {
        ...input,
        items: [
          { name: 'Synthetic dish', amount: '100000' },
          { name: 'Soup', amount: '70000' },
        ],
      },
      false,
    ],
    [id, id, null, true],
  ])
})
it.each(['ADMIN', 'MEMBER'] as const)(
  '%s cannot create/edit/delete or use parent prefill',
  async (role) => {
    const s = setup(role)
    for (const res of [
      await request(s.app).post('/food').send(input),
      await request(s.app)
        .put('/food/' + id)
        .send(input),
      await request(s.app).delete('/food/' + id),
      await request(s.app).get(
        '/food/prefill?mealDate=2026-10-22&mealType=DINNER',
      ),
    ])
      expect(res.status).toBe(403)
    expect(s.repository.mutate).not.toHaveBeenCalled()
  },
)
it.each([
  { ...input, mealType: 'LUNCH' },
  { ...input, mealType: ['DINNER'] },
  { ...input, note: 'x'.repeat(1001) },
  {
    ...input,
    items: Array.from({ length: 31 }, () => ({
      name: 'Synthetic dish',
      amount: '1',
    })),
  },
  { ...input, mealDate: '2026-02-30' },
  { ...input, mealDate: '2026-10-23' },
  { ...input, items: [] },
  { ...input, items: [{ name: ' ', amount: '1' }] },
  { ...input, items: [{ name: 'Dish', amount: '0' }] },
  { ...input, items: [{ name: 'Dish', amount: 100 }] },
  { ...input, items: [{ name: 'Dish', amount: '1.5' }] },
  { ...input, items: [{ name: 'Dish', amount: '1000000001' }] },
  { ...input, createdByMemberId: id },
  { ...input, items: [{ name: 'Dish', amount: '01' }] },
  { ...input, items: [{ name: 'Dish', amount: '1', id }] },
])('rejects invalid food input %# without storage changes', async (invalid) => {
  const s = setup()
  expect((await request(s.app).post('/food').send(invalid)).status).toBe(400)
  expect(s.repository.mutate).not.toHaveBeenCalled()
})
it('safe error responses do not expose storage details', async () => {
  const s = setup()
  vi.mocked(s.repository.read).mockRejectedValue(
    new Error('private database details'),
  )
  const r = await request(s.app).get('/food')
  expect(r.status).toBe(503)
  expect(JSON.stringify(r.body)).not.toContain('private database')
})
it('validates month/page and slot parameters', async () => {
  const s = setup()
  for (const url of [
    '/food?month=2026-13',
    '/food?page=0',
    '/food/slot?mealDate=2026-10-22&mealType=LUNCH',
  ])
    expect((await request(s.app).get(url)).status).toBe(400)
})
it('returns an honest zero-baseline shared Home summary without item details', async () => {
  const s = setup()
  vi.mocked(s.repository.read).mockResolvedValue({
    expenses: [],
    totalCount: 0,
    currentTotal: '0',
    previousTotal: '0',
    breakfastTotal: '0',
    dinnerTotal: '0',
    groceriesTotal: '0',
    categories: [],
    dailyTrend: [],
    monthlyTrend: [],
  })
  expect(await s.service.summary(s.actor)).toEqual({
    month: '2026-10',
    currency: 'VND',
    currentTotal: '0',
    previousTotal: '0',
    previousMonth: '2026-09',
    differenceAmount: '0',
    percentageChange: null,
    groceriesTotal: '0',
    categories: [],
    dailyTrend: [],
    monthlyTrend: [],
  })
})
it('all family-food endpoints require an active session', async () => {
  for (const url of [
    '/api/expenses/family-food',
    '/api/expenses/family-food/slot',
    '/api/expenses/family-food/prefill',
  ])
    expect((await request(app).get(url)).status).toBe(401)
  expect(
    (await request(app).post('/api/expenses/family-food').send(input)).status,
  ).toBe(401)
  expect(
    (
      await request(app)
        .put('/api/expenses/family-food/' + id)
        .send(input)
    ).status,
  ).toBe(401)
  expect(
    (await request(app).delete('/api/expenses/family-food/' + id)).status,
  ).toBe(401)
})
it('prefills editable dinner/breakfast names only, deduplicating without prices or non-eating states', async () => {
  const s = setup()
  const dinner = {
    get: vi.fn(async () => ({
      dishes: [{ name: 'Dinner dish' }, { name: 'Dinner dish' }],
    })),
  } as unknown as Pick<FinalMealService, 'get'>
  const breakfast = {
    getDay: vi.fn(async () => ({
      responses: [
        { state: 'SELECTED', catalogItem: { name: 'Breakfast dish' } },
        { state: 'CUSTOM', customText: 'Custom dish' },
        { state: 'NOT_EATING', customText: 'Not a suggestion' },
        { state: 'NO_RESPONSE' },
      ],
    })),
  } as unknown as Pick<BreakfastService, 'getDay'>
  const service = new FamilyFoodService(s.repository, { dinner, breakfast })
  expect(await service.prefill(s.actor, '2026-10-22', 'DINNER')).toEqual([
    'Dinner dish',
  ])
  expect(await service.prefill(s.actor, '2026-10-22', 'BREAKFAST')).toEqual([
    'Breakfast dish',
    'Custom dish',
  ])
  expect(dinner.get).toHaveBeenCalledWith('2026-10-22', 'DINNER')
})
it('repository validates exact totals and whitelists database rows', async () => {
  const rpc = vi.fn(async () => ({
    data: {
      expenses: [
        {
          id,
          ...input,
          items: [{ name: 'Dinner', amount: '170000' }],
          total: '170000',
          private: 'omit',
        },
      ],
      totalCount: 1,
      currentTotal: '170000',
      previousTotal: '0',
      breakfastTotal: '0',
      dinnerTotal: '170000',
      groceriesTotal: '0',
      categories: [
        { category: 'BREAKFAST', amount: '0' },
        { category: 'DINNER', amount: '170000' },
        { category: 'GROCERIES', amount: '0' },
      ],
      dailyTrend: [],
      monthlyTrend: [],
    },
    error: null,
  }))
  const repo = new SupabaseFamilyFoodRepository(
    () => ({ rpc }) as unknown as SupabaseClient,
  )
  const result = await repo.read(id, '2026-10', 1)
  expect(result.expenses[0]).toEqual({
    id,
    ...input,
    category: 'DINNER',
    items: [{ name: 'Dinner', amount: '170000' }],
    total: '170000',
  })
  expect(rpc).toHaveBeenCalledWith('family_food_read', {
    p_actor_member_id: id,
    p_month: '2026-10-01',
    p_page: 1,
  })
  rpc.mockResolvedValueOnce({
    data: { ...result, currentTotal: '170001' },
    error: null,
  })
  await expect(repo.read(id, '2026-10', 1)).rejects.toThrow(
    'Invalid food summary',
  )
})
