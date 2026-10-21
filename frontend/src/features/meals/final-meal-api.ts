import type { MealType } from './meal-request-api'
export const categoryLabels = {
  MAIN: 'Món chính',
  SOUP: 'Canh',
  SIDE: 'Món phụ',
  VEGETABLE: 'Rau',
  OTHER: 'Món khác',
}
export interface FinalDish {
  id?: string
  name: string
  category: keyof typeof categoryLabels
  sortOrder: number
}
export interface FinalMeal {
  id: string
  mealDate: string
  mealType: MealType
  mealRequestId: string | null
  finalizedByMemberId: string
  readyAt: string | null
  readyMessage: string | null
  createdAt: string
  updatedAt: string
  dishes: (FinalDish & { id: string })[]
}
export class FinalMealApiError extends Error {
  readonly code: string
  constructor(code: string) {
    super('Chưa thể tải hoặc lưu món ăn. Vui lòng thử lại.')
    this.code = code
  }
}
function path(date: string, type: MealType) {
  return `/api/meals/final/${encodeURIComponent(date)}/${type}`
}
export function fetchFinalMeal(date: string, type: MealType) {
  return requestMeal(path(date, type))
}
export async function saveFinalMeal(
  date: string,
  type: MealType,
  dishes: FinalDish[],
  mealRequestId: string | null,
) {
  const meal = await requestMeal(path(date, type), { dishes, mealRequestId })
  if (!meal) throw new FinalMealApiError('UNAVAILABLE')
  return meal
}
export async function markMealReady(
  date: string,
  type: MealType,
  readyMessage: string | null,
) {
  const meal = await requestMeal(`${path(date, type)}/ready`, { readyMessage })
  if (!meal) throw new FinalMealApiError('UNAVAILABLE')
  return meal
}
async function requestMeal(
  url: string,
  input?: unknown,
): Promise<FinalMeal | null> {
  try {
    const response = await fetch(url, {
      credentials: 'include',
      method: input === undefined ? 'GET' : 'PUT',
      headers: {
        Accept: 'application/json',
        ...(input === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    })
    const body: unknown = await response.json()
    if (!response.ok) {
      throw new FinalMealApiError(
        object(body) &&
        object(body.error) &&
        typeof body.error.code === 'string'
          ? body.error.code
          : 'UNAVAILABLE',
      )
    }
    if (
      !object(body) ||
      !('meal' in body) ||
      (body.meal !== null && !validMeal(body.meal))
    )
      throw new FinalMealApiError('UNAVAILABLE')
    return body.meal as FinalMeal | null
  } catch (error) {
    if (error instanceof FinalMealApiError) throw error
    throw new FinalMealApiError('UNAVAILABLE')
  }
}
function validMeal(value: unknown): value is FinalMeal {
  return (
    object(value) &&
    typeof value.id === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(value.mealDate)) &&
    ['LUNCH', 'DINNER'].includes(String(value.mealType)) &&
    (value.mealRequestId === null || typeof value.mealRequestId === 'string') &&
    typeof value.finalizedByMemberId === 'string' &&
    (value.readyAt === null || timestamp(value.readyAt)) &&
    (value.readyMessage === null || typeof value.readyMessage === 'string') &&
    timestamp(value.createdAt) &&
    timestamp(value.updatedAt) &&
    Array.isArray(value.dishes) &&
    value.dishes.length > 0 &&
    value.dishes.every(
      (dish, index) =>
        object(dish) &&
        typeof dish.id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          dish.id,
        ) &&
        typeof dish.name === 'string' &&
        !!dish.name.trim() &&
        typeof dish.category === 'string' &&
        Object.hasOwn(categoryLabels, dish.category) &&
        dish.sortOrder === index,
    )
  )
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function timestamp(value: unknown) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}
