import type { SafeFamilyProfile } from './family-auth.service.js'
import { ApiError } from '../errors/api-error.js'

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
    category: string
    sortOrder: number
    ratings: DishRating[]
  }[]
}
export interface DishRatingRepository {
  get(actorId: string, mealId: string): Promise<MealFeedback>
  save(
    actorId: string,
    dishId: string,
    rating: number,
    comment: string | null,
  ): Promise<DishRating>
}
export class DishRatingService {
  constructor(private readonly repository: DishRatingRepository) {}

  async get(actor: SafeFamilyProfile, mealId: unknown) {
    validateId(mealId)
    return this.run(() => this.repository.get(actor.id, mealId))
  }

  async save(actor: SafeFamilyProfile, dishId: unknown, input: unknown) {
    if (actor.role === 'PARENT')
      throw new ApiError(
        403,
        'RATING_FORBIDDEN',
        'Only active non-parent members may rate',
      )
    validateId(dishId)
    if (!input || typeof input !== 'object' || Array.isArray(input)) invalid()
    const value = input as Record<string, unknown>
    if (
      Object.keys(value).some((key) => !['rating', 'comment'].includes(key)) ||
      !Number.isInteger(value.rating) ||
      (value.rating as number) < 1 ||
      (value.rating as number) > 5 ||
      (value.comment !== undefined &&
        value.comment !== null &&
        typeof value.comment !== 'string')
    )
      invalid()
    const comment =
      typeof value.comment === 'string' ? value.comment.trim() || null : null
    if (comment && Array.from(comment).length > 300) invalid()
    return this.run(() =>
      this.repository.save(actor.id, dishId, value.rating as number, comment),
    )
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        503,
        'RATING_UNAVAILABLE',
        'Dish feedback is temporarily unavailable',
      )
    }
  }
}
function invalid(): never {
  throw new ApiError(
    400,
    'VALIDATION_ERROR',
    'Use an integer rating from 1 to 5 and an optional comment up to 300 characters',
  )
}
function validateId(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    invalid()
}
