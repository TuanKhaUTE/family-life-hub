import { ApiError } from '../errors/api-error.js'
import type { SafeFamilyProfile } from './family-auth.service.js'
import { getFamilyDate } from '../time/family-calendar.js'
import { validDate } from './calendar.service.js'
import {
  expenseId,
  expenseMonth,
  previousExpenseMonth,
  expenseComparison,
  money,
} from './personal-expense.service.js'
import type { FinalMealService } from './final-meal.service.js'
import type { BreakfastService } from './breakfast.service.js'

export interface FoodInput {
  mealDate: string
  mealType: 'BREAKFAST' | 'DINNER'
  note: string | null
  items: { name: string; amount: string }[]
}
export interface FoodExpense extends FoodInput {
  id: string
  total: string
}
export interface FoodData {
  expenses: FoodExpense[]
  totalCount: number
  currentTotal: string
  previousTotal: string
  breakfastTotal: string
  dinnerTotal: string
}
export interface FamilyFoodRepository {
  read(actor: string, month: string, page: number): Promise<FoodData>
  slot(
    actor: string,
    date: string,
    type: FoodInput['mealType'],
  ): Promise<FoodExpense | null>
  mutate(
    actor: string,
    id: string | null,
    input: FoodInput | null,
    remove: boolean,
  ): Promise<void>
}
export class FamilyFoodService {
  constructor(
    private readonly repository: FamilyFoodRepository,
    private readonly meals?: {
      dinner: Pick<FinalMealService, 'get'>
      breakfast: Pick<BreakfastService, 'getDay'>
    },
    private readonly clock = () => new Date(),
  ) {}
  async read(actor: SafeFamilyProfile, month?: unknown, page?: unknown) {
    const m =
      month === undefined
        ? getFamilyDate(this.clock()).slice(0, 7)
        : expenseMonth(month)
    if (
      page !== undefined &&
      (typeof page !== 'string' ||
        !/^[1-9]\d{0,5}$/.test(page) ||
        Number(page) > 100000)
    )
      invalid()
    const p = page === undefined ? 1 : Number(page)
    return this.run(async () => {
      const d = await this.repository.read(actor.id, m, p)
      return {
        month: m,
        currency: 'VND' as const,
        page: p,
        totalCount: d.totalCount,
        hasMore: p * 20 < d.totalCount,
        expenses: d.expenses,
        summary: {
          currentTotal: d.currentTotal,
          previousTotal: d.previousTotal,
          previousMonth: previousExpenseMonth(m),
          breakfastTotal: d.breakfastTotal,
          dinnerTotal: d.dinnerTotal,
          ...expenseComparison(d.currentTotal, d.previousTotal),
        },
      }
    })
  }
  async summary(actor: SafeFamilyProfile) {
    const { month, currency, summary: s } = await this.read(actor)
    return {
      month,
      currency,
      currentTotal: s.currentTotal,
      previousTotal: s.previousTotal,
      previousMonth: s.previousMonth,
      differenceAmount: s.differenceAmount,
      percentageChange: s.percentageChange,
    }
  }
  async slot(actor: SafeFamilyProfile, date: unknown, type: unknown) {
    foodSlot(date, type)
    return this.run(() =>
      this.repository.slot(
        actor.id,
        date as string,
        type as FoodInput['mealType'],
      ),
    )
  }
  async prefill(actor: SafeFamilyProfile, date: unknown, type: unknown) {
    parent(actor)
    foodSlot(date, type)
    return this.run(async () => {
      if (!this.meals) return []
      const names =
        type === 'DINNER'
          ? ((await this.meals.dinner.get(date, type))?.dishes.map(
              (d) => d.name,
            ) ?? [])
          : (await this.meals.breakfast.getDay(actor, date)).responses
              .filter((r) => r.state === 'SELECTED' || r.state === 'CUSTOM')
              .map((r) => r.catalogItem?.name ?? r.customText ?? '')
      // Names are editable snapshots, never links that can change historical costs.
      return [
        ...new Set(
          names
            .map((n) => Array.from(n.trim()).slice(0, 120).join(''))
            .filter(Boolean),
        ),
      ].slice(0, 30)
    })
  }
  async save(actor: SafeFamilyProfile, id: unknown, input: unknown) {
    parent(actor)
    if (id !== null) expenseId(id)
    const data = normalizeFood(input, getFamilyDate(this.clock()))
    await this.run(() =>
      this.repository.mutate(actor.id, id as string | null, data, false),
    )
  }
  async remove(actor: SafeFamilyProfile, id: unknown) {
    parent(actor)
    expenseId(id)
    await this.run(() => this.repository.mutate(actor.id, id, null, true))
  }
  private async run<T>(op: () => Promise<T>) {
    try {
      return await op()
    } catch (e) {
      if (e instanceof ApiError) throw e
      throw new ApiError(
        503,
        'FOOD_UNAVAILABLE',
        'Family food spending is temporarily unavailable',
      )
    }
  }
}
export function foodSlot(date: unknown, type: unknown) {
  if (
    !validDate(date) ||
    typeof type !== 'string' ||
    !['BREAKFAST', 'DINNER'].includes(type)
  )
    invalid()
}
export function normalizeFood(v: unknown, today: string): FoodInput {
  if (
    !object(v) ||
    Object.keys(v).some(
      (k) => !['mealDate', 'mealType', 'note', 'items'].includes(k),
    )
  )
    invalid()
  foodSlot(v.mealDate, v.mealType)
  if (
    (v.mealDate as string) > today ||
    !Array.isArray(v.items) ||
    v.items.length < 1 ||
    v.items.length > 30
  )
    invalid()
  if (
    v.note != null &&
    (typeof v.note !== 'string' || Array.from(v.note.trim()).length > 1000)
  )
    invalid()
  const items = v.items.map((i) => {
    if (
      !object(i) ||
      Object.keys(i).some((k) => !['name', 'amount'].includes(k)) ||
      typeof i.name !== 'string' ||
      !i.name.trim() ||
      Array.from(i.name.trim()).length > 120 ||
      !money(i.amount) ||
      i.amount.length > 10 ||
      BigInt(i.amount) < 1n ||
      BigInt(i.amount) > 1000000000n
    )
      invalid()
    return { name: i.name.trim(), amount: i.amount }
  })
  return {
    mealDate: v.mealDate as string,
    mealType: v.mealType as FoodInput['mealType'],
    note: typeof v.note === 'string' ? v.note.trim() || null : null,
    items,
  }
}
function parent(actor: SafeFamilyProfile) {
  if (actor.role !== 'PARENT')
    throw new ApiError(
      403,
      'FOOD_FORBIDDEN',
      'Only a parent may manage family food spending',
    )
}
function invalid(): never {
  throw new ApiError(400, 'FOOD_INVALID', 'Invalid family food expense')
}
function object(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
