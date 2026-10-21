import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '../config/supabase.js'
import {
  FinalMealError,
  DISH_CATEGORIES,
  type FinalMeal,
  type FinalMealRepository,
} from '../services/final-meal.service.js'
import type { MealType } from '../services/meal-request.service.js'
import { isFamilyDate } from '../time/family-calendar.js'

export class SupabaseFinalMealRepository implements FinalMealRepository {
  private client?: SupabaseClient
  constructor(
    private readonly factory: () => SupabaseClient = createSupabaseServerClient,
  ) {}
  private getClient() {
    return (this.client ??= this.factory())
  }
  async get(date: string, type: MealType): Promise<FinalMeal | null> {
    const { data, error } = await this.getClient()
      .from('final_meals')
      .select(
        'id,meal_date,meal_type,meal_request_id,finalized_by_member_id,ready_at,ready_message,created_at,updated_at,final_meal_dishes(name,category,sort_order)',
      )
      .eq('meal_date', date)
      .eq('meal_type', type)
      .maybeSingle()
    if (error) throw new Error('Final meal read failed')
    return data === null ? null : decodeFinalMeal(data)
  }
  async save(input: Parameters<FinalMealRepository['save']>[0]) {
    const { data, error } = await this.getClient().rpc('save_final_meal', {
      p_actor_member_id: input.actorMemberId,
      p_meal_date: input.mealDate,
      p_meal_type: input.mealType,
      p_meal_request_id: input.mealRequestId,
      p_dishes: input.dishes.map((dish) => ({
        name: dish.name,
        category: dish.category,
        sort_order: dish.sortOrder,
      })),
    })
    checkError(error)
    return decodeFinalMeal(data)
  }
  async ready(input: Parameters<FinalMealRepository['ready']>[0]) {
    const { data, error } = await this.getClient().rpc(
      'mark_final_meal_ready',
      {
        p_actor_member_id: input.actorMemberId,
        p_meal_date: input.mealDate,
        p_meal_type: input.mealType,
        p_ready_message: input.readyMessage,
      },
    )
    checkError(error)
    return decodeFinalMeal(data)
  }
}
function checkError(error: { code?: string } | null) {
  if (!error) return
  if (error.code === '42501')
    throw new FinalMealError(
      403,
      'FINAL_MEAL_FORBIDDEN',
      'Only an active parent can manage final meals',
    )
  if (error.code === 'P0002')
    throw new FinalMealError(
      404,
      'FINAL_MEAL_NOT_FOUND',
      'Final meal was not found',
    )
  if (error.code === 'P2001')
    throw new FinalMealError(
      409,
      'FINAL_MEAL_SELF_SERVICE',
      'Change the self-service plan before saving dishes',
    )
  if (['23503', '23514', '22023'].includes(error.code ?? ''))
    throw new FinalMealError(
      400,
      'VALIDATION_ERROR',
      'Invalid final meal input or linked request',
    )
  throw new Error('Final meal write failed')
}
export function decodeFinalMeal(value: unknown): FinalMeal {
  if (
    !object(value) ||
    !uuid(value.id) ||
    !isFamilyDate(value.meal_date) ||
    !['LUNCH', 'DINNER'].includes(String(value.meal_type)) ||
    (value.meal_request_id !== null && !uuid(value.meal_request_id)) ||
    !uuid(value.finalized_by_member_id) ||
    (value.ready_at !== null && !timestamp(value.ready_at)) ||
    (value.ready_message !== null && typeof value.ready_message !== 'string') ||
    !timestamp(value.created_at) ||
    !timestamp(value.updated_at) ||
    !Array.isArray(value.final_meal_dishes) ||
    !value.final_meal_dishes.length
  )
    throw new Error('Invalid final meal response')
  const dishes = value.final_meal_dishes
    .map((dish) => {
      if (
        !object(dish) ||
        typeof dish.name !== 'string' ||
        !dish.name.trim() ||
        !DISH_CATEGORIES.includes(dish.category as never) ||
        !Number.isInteger(dish.sort_order)
      )
        throw new Error('Invalid final meal dish')
      return {
        name: dish.name,
        category: dish.category as FinalMeal['dishes'][number]['category'],
        sortOrder: dish.sort_order as number,
      }
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
  if (dishes.some((dish, index) => dish.sortOrder !== index))
    throw new Error('Invalid dish ordering')
  return {
    id: value.id as string,
    mealDate: value.meal_date,
    mealType: value.meal_type as MealType,
    mealRequestId: value.meal_request_id as string | null,
    finalizedByMemberId: value.finalized_by_member_id as string,
    readyAt: value.ready_at as string | null,
    readyMessage: value.ready_message as string | null,
    createdAt: value.created_at as string,
    updatedAt: value.updated_at as string,
    dishes,
  }
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function uuid(value: unknown) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}
function timestamp(value: unknown) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}
