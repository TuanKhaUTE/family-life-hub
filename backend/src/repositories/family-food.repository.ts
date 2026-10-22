import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '../config/supabase.js'
import { ApiError } from '../errors/api-error.js'
import {
  normalizeFood,
  type FamilyFoodRepository,
  type FoodInput,
  type FoodExpense,
  type FoodData,
  type FoodMealType,
  type MealFoodInput,
  type GroceryFoodInput,
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
      !money(v.groceriesTotal) ||
      BigInt(v.breakfastTotal) + BigInt(v.dinnerTotal) !==
        BigInt(v.currentTotal) - BigInt(v.groceriesTotal) ||
      !Array.isArray(v.categories) ||
      !Array.isArray(v.dailyTrend) ||
      !Array.isArray(v.monthlyTrend)
    )
      throw new Error('Invalid food summary')
    const categories = v.categories.map(parseCategoryTotal)
    if (
      categories.length !== 3 ||
      new Set(categories.map((c) => c.category)).size !== 3 ||
      categories.reduce((sum, c) => sum + BigInt(c.amount), 0n) !==
        BigInt(v.currentTotal)
    )
      throw new Error('Invalid food categories')
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
      groceriesTotal: v.groceriesTotal,
      categories,
      dailyTrend: v.dailyTrend.map(parseDailyTrend),
      monthlyTrend: v.monthlyTrend.map(parseMonthlyTrend),
    }
  }
  async slot(actor: string, date: string, type: FoodMealType) {
    const v = await this.rpc('family_food_slot', {
      p_actor_member_id: actor,
      p_date: date,
      p_type: type,
    })
    if (v === null) return null
    const expense = parseFood(v)
    if (expense.mealDate !== date || expense.category !== type)
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
  if (v.category === 'GROCERIES') {
    const input = normalizeFood(
      {
        mealDate: v.mealDate,
        category: 'GROCERIES',
        amount: v.amount ?? v.total,
        note: v.note,
      },
      '2199-12-31',
    )
    const grocery = input as GroceryFoodInput
    if (v.total !== grocery.amount)
      throw new Error('Invalid grocery total')
    return {
      id: v.id,
      ...grocery,
      total: grocery.amount,
    }
  }
  const input = normalizeFood(
    {
      mealDate: v.mealDate,
      mealType: v.mealType,
      note: v.note,
      items: v.items,
    },
    '2199-12-31',
  )
  const meal = input as MealFoodInput
  const total = meal.items
    .reduce((s, i) => s + BigInt(i.amount), 0n)
    .toString()
  if (v.total !== total) throw new Error('Invalid food total')
  return { id: v.id, ...meal, category: meal.mealType, total }
}
function parseCategoryTotal(value: unknown) {
  if (
    !object(value) ||
    !['BREAKFAST', 'DINNER', 'GROCERIES'].includes(String(value.category)) ||
    !money(value.amount)
  )
    throw new Error('Invalid food category total')
  return {
    category: value.category as 'BREAKFAST' | 'DINNER' | 'GROCERIES',
    amount: value.amount,
  }
}
function parseDailyTrend(value: unknown) {
  if (!object(value) || typeof value.date !== 'string' || !money(value.amount))
    throw new Error('Invalid food daily trend')
  return { date: value.date, amount: value.amount }
}
function parseMonthlyTrend(value: unknown) {
  if (
    !object(value) ||
    typeof value.month !== 'string' ||
    !/^20\d\d-(0[1-9]|1[0-2])$/.test(value.month) ||
    !money(value.amount)
  )
    throw new Error('Invalid food monthly trend')
  return { month: value.month, amount: value.amount }
}
function object(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
