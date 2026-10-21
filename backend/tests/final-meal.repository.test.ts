import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { SupabaseFinalMealRepository } from '../src/repositories/final-meal.repository.js'

const id = '11111111-1111-4111-8111-111111111111'
const row = {
  id,
  meal_date: '2099-05-01',
  meal_type: 'DINNER',
  meal_request_id: null,
  finalized_by_member_id: id,
  ready_at: null,
  ready_message: null,
  created_at: '2099-05-01T10:00:00Z',
  updated_at: '2099-05-01T10:00:00Z',
  final_meal_dishes: [
    { name: 'Canh', category: 'SOUP', sort_order: 1 },
    { name: 'Cơm', category: 'MAIN', sort_order: 0 },
  ],
}
function setup(data: unknown = row, error: { code?: string } | null = null) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  }
  const client = {
    from: vi.fn(() => builder),
    rpc: vi.fn().mockResolvedValue({ data, error }),
  }
  return {
    builder,
    client,
    repository: new SupabaseFinalMealRepository(
      () => client as unknown as SupabaseClient,
    ),
  }
}
describe('final meal repository', () => {
  it('reads a scoped slot and returns ordered dishes', async () => {
    const { repository, builder } = setup()
    const meal = await repository.get('2099-05-01', 'DINNER')
    expect(meal?.dishes.map((dish) => dish.name)).toEqual(['Cơm', 'Canh'])
    expect(builder.eq.mock.calls).toEqual([
      ['meal_date', '2099-05-01'],
      ['meal_type', 'DINNER'],
    ])
  })
  it('returns null for an empty slot', async () => {
    await expect(
      setup(null).repository.get('2099-05-01', 'LUNCH'),
    ).resolves.toBeNull()
  })
  it('replaces dishes through one atomic RPC', async () => {
    const { repository, client } = setup()
    await repository.save({
      actorMemberId: id,
      mealDate: '2099-05-01',
      mealType: 'DINNER',
      mealRequestId: null,
      dishes: [{ name: 'Cơm', category: 'MAIN', sortOrder: 0 }],
    })
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('save_final_meal', {
      p_actor_member_id: id,
      p_meal_date: '2099-05-01',
      p_meal_type: 'DINNER',
      p_meal_request_id: null,
      p_dishes: [{ name: 'Cơm', category: 'MAIN', sort_order: 0 }],
    })
  })
  it('marks ready using only the session actor and slot', async () => {
    const { repository, client } = setup()
    await repository.ready({
      actorMemberId: id,
      mealDate: '2099-05-01',
      mealType: 'LUNCH',
      readyMessage: 'Ăn cơm nhé',
    })
    expect(client.rpc).toHaveBeenCalledWith('mark_final_meal_ready', {
      p_actor_member_id: id,
      p_meal_date: '2099-05-01',
      p_meal_type: 'LUNCH',
      p_ready_message: 'Ăn cơm nhé',
    })
  })
  it.each([
    ['23503', 'VALIDATION_ERROR'],
    ['P2001', 'FINAL_MEAL_SELF_SERVICE'],
    ['42501', 'FINAL_MEAL_FORBIDDEN'],
    ['P0002', 'FINAL_MEAL_NOT_FOUND'],
  ])('maps safe database error %s', async (code, expected) => {
    await expect(
      setup(null, { code }).repository.ready({
        actorMemberId: id,
        mealDate: '2099-05-01',
        mealType: 'LUNCH',
        readyMessage: null,
      }),
    ).rejects.toMatchObject({ code: expected })
  })
  it.each([
    {},
    { ...row, final_meal_dishes: [] },
    {
      ...row,
      final_meal_dishes: [{ name: 'Dish', category: 'BAD', sort_order: 0 }],
    },
    { ...row, ready_at: 'invalid' },
  ])('rejects malformed persistence response %#', async (value) => {
    await expect(
      setup(value).repository.get('2099-05-01', 'LUNCH'),
    ).rejects.toThrow('Invalid')
  })
})
