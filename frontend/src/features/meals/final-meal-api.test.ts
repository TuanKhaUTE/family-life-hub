import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchFinalMeal, saveFinalMeal, markMealReady } from './final-meal-api'

const meal = {
  id: '11111111-1111-4111-8111-111111111111',
  mealDate: '2099-05-01',
  mealType: 'LUNCH',
  mealRequestId: null,
  finalizedByMemberId: '11111111-1111-4111-8111-111111111111',
  readyAt: null,
  readyMessage: null,
  createdAt: '2099-05-01T00:00:00Z',
  updatedAt: '2099-05-01T00:00:00Z',
  dishes: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Canh cải',
      category: 'SOUP' as const,
      sortOrder: 0,
    },
  ],
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
afterEach(() => vi.unstubAllGlobals())
describe('final meal API client', () => {
  it('rejects a saved dish without its identity instead of silently replacing it on edit', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json({
            meal: {
              ...meal,
              dishes: [{ name: 'Canh cải', category: 'SOUP', sortOrder: 0 }],
            },
          }),
        ),
    )
    await expect(fetchFinalMeal('2099-05-01', 'LUNCH')).rejects.toThrow(
      'Chưa thể',
    )
  })
  it('fetches an authenticated slot and allows a null meal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ meal: null }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchFinalMeal('2099-05-01', 'LUNCH')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/meals/final/2099-05-01/LUNCH',
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
    )
  })
  it('saves multiple ordered dishes without actor fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ meal }))
    vi.stubGlobal('fetch', fetchMock)
    await saveFinalMeal('2099-05-01', 'LUNCH', meal.dishes, null)
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      dishes: meal.dishes,
      mealRequestId: null,
    })
  })
  it('uses the idempotent ready resource for both ready and message updates', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ meal }))
    vi.stubGlobal('fetch', fetchMock)
    await markMealReady('2099-05-01', 'LUNCH', 'Ăn cơm nhé')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/meals/final/2099-05-01/LUNCH/ready',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ readyMessage: 'Ăn cơm nhé' }),
      }),
    )
  })
  it.each([
    {},
    { meal: { ...meal, dishes: [] } },
    {
      meal: {
        ...meal,
        dishes: [{ name: 'Dish', category: 'BAD', sortOrder: 0 }],
      },
    },
  ])('rejects unsafe response shape %#', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(body)))
    await expect(fetchFinalMeal('2099-05-01', 'LUNCH')).rejects.toThrow(
      'Chưa thể',
    )
  })
  it('preserves a safe self-service conflict code without exposing server detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json(
          {
            error: {
              code: 'FINAL_MEAL_SELF_SERVICE',
              message: 'private detail',
            },
          },
          409,
        ),
      ),
    )
    await expect(
      saveFinalMeal('2099-05-01', 'LUNCH', meal.dishes, null),
    ).rejects.toMatchObject({
      code: 'FINAL_MEAL_SELF_SERVICE',
      message: 'Chưa thể tải hoặc lưu món ăn. Vui lòng thử lại.',
    })
  })
  it('redacts network errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('private detail')),
    )
    await expect(fetchFinalMeal('2099-05-01', 'LUNCH')).rejects.toThrow(
      'Chưa thể',
    )
  })
})
