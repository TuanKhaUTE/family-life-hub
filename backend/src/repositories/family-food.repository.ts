import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '../config/supabase.js'
import { ApiError } from '../errors/api-error.js'
import {
  normalizeFood,
  type FamilyFoodRepository,
  type FoodInput,
  type FoodExpense,
  type FoodData,
} from '../services/family-food.service.js'
import { expenseId, money } from '../services/personal-expense.service.js'
export class SupabaseFamilyFoodRepository implements FamilyFoodRepository {
  private client?: SupabaseClient
  constructor(private readonly factory = createSupabaseServerClient) {}
  private async rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await (this.client ??= this.factory()).rpc(
      name,
      args,
    )
    if (error) {
      const status =
        error.code === '42501'
          ? 403
          : error.code === 'P0002'
            ? 404
            : error.code === '23505'
              ? 409
              : [
                    '22023',
                    '23514',
                    '23502',
                    '22P02',
                    '22003',
                    '22007',
                    '22008',
                  ].includes(error.code)
                ? 400
                : 503
      throw new ApiError(
        status,
        status === 409 ? 'FOOD_SLOT_EXISTS' : 'FOOD_UNAVAILABLE',
        status === 409
          ? 'This meal already has a food expense'
          : 'Family food expense request could not be completed',
      )
    }
    return data as unknown
  }
  async read(actor: string, month: string, page: number): Promise<FoodData> {
    const v = await this.rpc('family_food_read', {
      p_actor_member_id: actor,
      p_month: month + '-01',
      p_page: page,
    })
    if (
      !object(v) ||
      !Array.isArray(v.expenses) ||
      v.expenses.length > 20 ||
      !Number.isSafeInteger(v.totalCount) ||
      (v.totalCount as number) < v.expenses.length ||
      !money(v.currentTotal) ||
      !money(v.previousTotal) ||
      !money(v.breakfastTotal) ||
      !money(v.dinnerTotal) ||
      BigInt(v.breakfastTotal) + BigInt(v.dinnerTotal) !==
        BigInt(v.currentTotal)
    )
      throw new Error('Invalid food summary')
    const expenses = v.expenses.map(parseFood)
    if (expenses.some((e) => e.mealDate.slice(0, 7) !== month))
      throw new Error('Invalid food month')
    return {
      expenses,
      totalCount: v.totalCount as number,
      currentTotal: v.currentTotal,
      previousTotal: v.previousTotal,
      breakfastTotal: v.breakfastTotal,
      dinnerTotal: v.dinnerTotal,
    }
  }
  async slot(actor: string, date: string, type: FoodInput['mealType']) {
    const v = await this.rpc('family_food_slot', {
      p_actor_member_id: actor,
      p_date: date,
      p_type: type,
    })
    if (v === null) return null
    const expense = parseFood(v)
    if (expense.mealDate !== date || expense.mealType !== type)
      throw new Error('Invalid food slot')
    return expense
  }
  async mutate(
    actor: string,
    id: string | null,
    input: FoodInput | null,
    remove: boolean,
  ) {
    await this.rpc('family_food_mutate', {
      p_actor_member_id: actor,
      p_id: id,
      p_input: input,
      p_remove: remove,
    })
  }
}
function parseFood(v: unknown): FoodExpense {
  if (!object(v)) throw new Error('Invalid food expense')
  expenseId(v.id)
  const input = normalizeFood(
    {
      mealDate: v.mealDate,
      mealType: v.mealType,
      note: v.note,
      items: v.items,
    },
    '2199-12-31',
  )
  const total = input.items
    .reduce((s, i) => s + BigInt(i.amount), 0n)
    .toString()
  if (v.total !== total) throw new Error('Invalid food total')
  return { id: v.id, ...input, total }
}
function object(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
