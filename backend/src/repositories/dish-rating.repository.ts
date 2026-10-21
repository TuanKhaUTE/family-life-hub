import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '../config/supabase.js'
import { ApiError } from '../errors/api-error.js'
import type {
  DishRating,
  DishRatingRepository,
  MealFeedback,
} from '../services/dish-rating.service.js'

export class SupabaseDishRatingRepository implements DishRatingRepository {
  private client?: SupabaseClient
  constructor(
    private readonly factory: () => SupabaseClient = createSupabaseServerClient,
  ) {}
  private async call(
    name: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    const { data, error } = await (this.client ??= this.factory()).rpc(
      name,
      input,
    )
    if (error) {
      if (error.code === '42501')
        throw new ApiError(
          403,
          'RATING_FORBIDDEN',
          'An active authorized member is required',
        )
      if (error.code === 'P0002')
        throw new ApiError(
          404,
          'RATING_NOT_FOUND',
          'Meal or dish was not found',
        )
      if (error.code === 'P2002')
        throw new ApiError(
          409,
          'MEAL_NOT_READY',
          'The meal is not ready for feedback',
        )
      if (['22023', '23514'].includes(error.code))
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid dish feedback')
      throw new Error('Dish feedback database operation failed')
    }
    return data
  }
  async get(actorId: string, mealId: string): Promise<MealFeedback> {
    const data = await this.call('read_final_meal_dish_ratings', {
      p_actor_member_id: actorId,
      p_meal_id: mealId,
    })
    if (
      !object(data) ||
      data.mealId !== mealId ||
      typeof data.ready !== 'boolean' ||
      !Array.isArray(data.dishes)
    )
      throw new Error('Invalid feedback response')
    return {
      mealId,
      ready: data.ready,
      dishes: data.dishes.map((dish) => {
        if (
          !object(dish) ||
          typeof dish.id !== 'string' ||
          typeof dish.name !== 'string' ||
          !['MAIN', 'SOUP', 'SIDE', 'VEGETABLE', 'OTHER'].includes(
            String(dish.category),
          ) ||
          !Number.isInteger(dish.sortOrder) ||
          !Array.isArray(dish.ratings)
        )
          throw new Error('Invalid dish feedback')
        return {
          id: dish.id,
          name: dish.name,
          category: dish.category as string,
          sortOrder: dish.sortOrder as number,
          ratings: dish.ratings.map(decodeRating),
        }
      }),
    }
  }
  async save(
    actorId: string,
    dishId: string,
    rating: number,
    comment: string | null,
  ) {
    return decodeRating(
      await this.call('save_final_meal_dish_rating', {
        p_actor_member_id: actorId,
        p_dish_id: dishId,
        p_rating: rating,
        p_comment: comment,
      }),
    )
  }
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function decodeRating(data: unknown): DishRating {
  if (
    !object(data) ||
    typeof data.memberId !== 'string' ||
    typeof data.displayName !== 'string' ||
    !Number.isInteger(data.rating) ||
    (data.rating as number) < 1 ||
    (data.rating as number) > 5 ||
    (data.comment !== null && typeof data.comment !== 'string') ||
    !timestamp(data.createdAt) ||
    !timestamp(data.updatedAt)
  )
    throw new Error('Invalid rating response')
  return {
    memberId: data.memberId,
    displayName: data.displayName,
    rating: data.rating as number,
    comment: data.comment as string | null,
    createdAt: data.createdAt as string,
    updatedAt: data.updatedAt as string,
  }
}
function timestamp(value: unknown) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}
