import { categoryLabels } from './final-meal-api'

export interface DishRating {
  memberId: string
  displayName: string
  rating: number
  comment: string | null
  createdAt: string
  updatedAt: string
}
export interface MealFeedback {
  mealId: string
  ready: boolean
  dishes: {
    id: string
    name: string
    category: keyof typeof categoryLabels
    sortOrder: number
    ratings: DishRating[]
  }[]
}
export class DishRatingApiError extends Error {
  readonly code: string
  constructor(code: string) {
    super('Chưa thể tải hoặc lưu đánh giá. Bạn thử lại nhé.')
    this.code = code
  }
}
async function request(
  url: string,
  input?: unknown,
): Promise<Record<string, unknown>> {
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
    const data: unknown = await response.json()
    if (!response.ok || !object(data))
      throw new DishRatingApiError(
        object(data) &&
        object(data.error) &&
        typeof data.error.code === 'string'
          ? data.error.code
          : 'UNAVAILABLE',
      )
    return data
  } catch (error) {
    if (error instanceof DishRatingApiError) throw error
    throw new DishRatingApiError('UNAVAILABLE')
  }
}
export async function fetchMealFeedback(mealId: string): Promise<MealFeedback> {
  const { feedback } = await request(
    `/api/meals/final/${encodeURIComponent(mealId)}/ratings`,
  )
  if (
    !object(feedback) ||
    feedback.mealId !== mealId ||
    typeof feedback.ready !== 'boolean' ||
    !Array.isArray(feedback.dishes) ||
    !feedback.dishes.every(
      (dish, index) =>
        object(dish) &&
        typeof dish.id === 'string' &&
        typeof dish.name === 'string' &&
        Object.hasOwn(categoryLabels, String(dish.category)) &&
        dish.sortOrder === index &&
        Array.isArray(dish.ratings) &&
        dish.ratings.every(validRating),
    )
  )
    throw new DishRatingApiError('UNAVAILABLE')
  return feedback as unknown as MealFeedback
}
export async function saveDishRating(
  dishId: string,
  rating: number,
  comment: string | null,
): Promise<DishRating> {
  const data = await request(
    `/api/meals/dishes/${encodeURIComponent(dishId)}/rating`,
    { rating, comment },
  )
  if (!validRating(data.rating)) throw new DishRatingApiError('UNAVAILABLE')
  return data.rating
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function validRating(value: unknown): value is DishRating {
  return (
    object(value) &&
    typeof value.memberId === 'string' &&
    typeof value.displayName === 'string' &&
    Number.isInteger(value.rating) &&
    (value.rating as number) >= 1 &&
    (value.rating as number) <= 5 &&
    (value.comment === null || typeof value.comment === 'string') &&
    typeof value.createdAt === 'string' &&
    !Number.isNaN(Date.parse(value.createdAt)) &&
    typeof value.updatedAt === 'string' &&
    !Number.isNaN(Date.parse(value.updatedAt))
  )
}
