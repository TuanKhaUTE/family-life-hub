import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { SupabaseHomeRepository } from '../src/repositories/home.repository.js'

function setup(rows: unknown, status = 200) {
  const urls: URL[] = []
  const client = createClient(
    'https://synthetic.supabase.co',
    'synthetic-test-key',
    {
      global: {
        fetch: async (input) => {
          urls.push(new URL(String(input)))
          return new Response(JSON.stringify(rows), {
            status,
            headers: { 'Content-Type': 'application/json' },
          })
        },
      },
    },
  )
  return { repository: new SupabaseHomeRepository(() => client), urls }
}
const dish = {
  id: 'dish-1',
  name: 'Món thử nghiệm',
  sort_order: 0,
  final_meals: { meal_date: '2099-05-01' },
  final_meal_dish_ratings: [
    { member_id: 'self', rating: 5 },
    { member_id: 'other', rating: 4 },
  ],
}
describe('home recent dish projection', () => {
  it('aggregates scores and only returns own individual rating', async () => {
    const s = setup([dish])
    expect(await s.repository.listRecent('self', false, '2099-05-02')).toEqual([
      {
        id: 'dish-1',
        name: 'Món thử nghiệm',
        mealDate: '2099-05-01',
        averageRating: 4.5,
        ratingCount: 2,
        ownRating: 5,
      },
    ])
    const query = s.urls[0]!.searchParams
    expect(query.get('limit')).toBe('3')
    expect(query.get('final_meals.meal_type')).toBe('eq.DINNER')
    expect(query.get('final_meals.ready_at')).toBe('not.is.null')
    expect(query.get('final_meals.meal_date')).toBe('lte.2099-05-02')
    expect(query.get('order')).toBe(
      'final_meals(meal_date).desc,sort_order.asc,id.asc',
    )
    expect(query.get('select')).not.toMatch(
      /comment|display_name|credentials|sessions/,
    )
  })
  it('parent sees only rated dishes and no individual score', async () => {
    const s = setup([dish])
    expect(
      (await s.repository.listRecent('self', true, '2099-05-02'))[0],
    ).toMatchObject({ ownRating: null, averageRating: 4.5 })
    expect(s.urls[0]!.searchParams.get('select')).toContain(
      'final_meal_dish_ratings!inner',
    )
  })
  it('unrated ready dishes have no invented average', async () => {
    const s = setup([{ ...dish, final_meal_dish_ratings: [] }])
    expect(
      (await s.repository.listRecent('self', false, '2099-05-02'))[0],
    ).toMatchObject({ averageRating: null, ratingCount: 0, ownRating: null })
  })
  it('supports empty history', async () => {
    expect(
      await setup([]).repository.listRecent('self', true, '2099-05-02'),
    ).toEqual([])
  })
  it.each([
    null,
    [{ ...dish, final_meal_dish_ratings: [{ member_id: 'self', rating: 8 }] }],
  ])('rejects malformed database data', async (rows) => {
    await expect(
      setup(rows).repository.listRecent('self', false, '2099-05-02'),
    ).rejects.toThrow()
  })
  it('does not leak database error details', async () => {
    await expect(
      setup({ message: 'private detail' }, 500).repository.listRecent(
        'self',
        false,
        '2099-05-02',
      ),
    ).rejects.toThrow('Recent dishes are unavailable')
  })
})
