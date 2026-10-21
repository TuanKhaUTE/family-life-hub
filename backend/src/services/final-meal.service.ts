import type { SafeFamilyProfile } from './family-auth.service.js'
import type { MealType } from './meal-request.service.js'
import { isFamilyDate } from '../time/family-calendar.js'

export const DISH_CATEGORIES = [
  'MAIN',
  'SOUP',
  'SIDE',
  'VEGETABLE',
  'OTHER',
] as const
export interface FinalMealDish {
  id?: string
  name: string
  category: (typeof DISH_CATEGORIES)[number]
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
  dishes: (FinalMealDish & { id: string })[]
}
export interface FinalMealRepository {
  get(date: string, type: MealType): Promise<FinalMeal | null>
  save(input: {
    actorMemberId: string
    mealDate: string
    mealType: MealType
    mealRequestId: string | null
    dishes: FinalMealDish[]
  }): Promise<FinalMeal>
  ready(input: {
    actorMemberId: string
    mealDate: string
    mealType: MealType
    readyMessage: string | null
  }): Promise<FinalMeal>
}
export class FinalMealError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
  }
}
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class FinalMealService {
  constructor(private readonly repository: FinalMealRepository) {}

  async get(date: unknown, type: unknown) {
    const slot = validateSlot(date, type)
    return this.run(() => this.repository.get(slot.mealDate, slot.mealType))
  }

  async save(
    profile: SafeFamilyProfile,
    date: unknown,
    type: unknown,
    input: unknown,
  ) {
    requireParent(profile)
    const slot = validateSlot(date, type)
    if (
      !object(input) ||
      !keys(input, ['mealRequestId', 'dishes']) ||
      !Array.isArray(input.dishes) ||
      input.dishes.length < 1 ||
      input.dishes.length > 30
    )
      invalid()
    const mealRequestId = input.mealRequestId ?? null
    if (
      mealRequestId !== null &&
      (typeof mealRequestId !== 'string' || !UUID.test(mealRequestId))
    )
      invalid()
    const dishes = input.dishes.map((dish, index): FinalMealDish => {
      if (
        !object(dish) ||
        !keys(dish, ['id', 'name', 'category', 'sortOrder']) ||
        ('id' in dish &&
          (typeof dish.id !== 'string' || !UUID.test(dish.id))) ||
        typeof dish.name !== 'string' ||
        !dish.name.trim() ||
        dish.name.trim().length > 120 ||
        !DISH_CATEGORIES.includes(dish.category as FinalMealDish['category']) ||
        dish.sortOrder !== index
      )
        invalid()
      return {
        ...(typeof dish.id === 'string' ? { id: dish.id.toLowerCase() } : {}),
        name: dish.name.trim(),
        category: dish.category as FinalMealDish['category'],
        sortOrder: index,
      }
    })
    const ids = dishes.flatMap((dish) => (dish.id ? [dish.id] : []))
    if (new Set(ids).size !== ids.length) invalid()
    return this.run(async () => {
      const current = await this.repository.get(slot.mealDate, slot.mealType)
      if (current?.readyAt)
        throw new FinalMealError(
          409,
          'FINAL_MEAL_LOCKED',
          'Ready meal composition cannot be changed',
        )
      return this.repository.save({
        ...slot,
        actorMemberId: profile.id,
        mealRequestId,
        dishes,
      })
    })
  }

  async ready(
    profile: SafeFamilyProfile,
    date: unknown,
    type: unknown,
    input: unknown,
  ) {
    requireParent(profile)
    const slot = validateSlot(date, type)
    if (!object(input) || !keys(input, ['readyMessage'])) invalid()
    if (
      input.readyMessage != null &&
      (typeof input.readyMessage !== 'string' ||
        input.readyMessage.trim().length > 300)
    )
      invalid()
    const readyMessage =
      typeof input.readyMessage === 'string'
        ? input.readyMessage.trim() || null
        : null
    return this.run(() =>
      this.repository.ready({
        ...slot,
        actorMemberId: profile.id,
        readyMessage,
      }),
    )
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (error instanceof FinalMealError) throw error
      throw new FinalMealError(
        503,
        'FINAL_MEAL_UNAVAILABLE',
        'Final meal is temporarily unavailable',
      )
    }
  }
}
function requireParent(profile: SafeFamilyProfile) {
  if (profile.role !== 'PARENT')
    throw new FinalMealError(
      403,
      'FINAL_MEAL_FORBIDDEN',
      'Only a parent can manage final meals',
    )
}
function validateSlot(
  date: unknown,
  type: unknown,
): { mealDate: string; mealType: MealType } {
  if (!isFamilyDate(date) || (type !== 'LUNCH' && type !== 'DINNER')) invalid()
  return { mealDate: date, mealType: type }
}
function invalid(): never {
  throw new FinalMealError(400, 'VALIDATION_ERROR', 'Invalid final meal input')
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).every((key) => allowed.includes(key))
}
