import { validExpenseHomeSummary, type ExpenseHomeSummary } from './expense-api'
export type FoodMealType = 'BREAKFAST' | 'DINNER'
export type FoodCategory = FoodMealType | 'GROCERIES'
export interface MealFoodInput {
  mealDate: string
  mealType: FoodMealType
  note: string | null
  items: { name: string; amount: string }[]
}
export interface GroceryFoodInput {
  mealDate: string
  category: 'GROCERIES'
  amount: string
  note: string | null
}
export type FoodInput = MealFoodInput | GroceryFoodInput
export interface FoodExpense {
  id: string
  mealDate: string
  mealType: FoodMealType | null
  category: FoodCategory
  note: string | null
  items: { name: string; amount: string }[]
  total: string
}
export interface FoodCategoryTotal {
  category: FoodCategory
  amount: string
}
export interface FoodTrendPoint {
  date: string
  amount: string
}
export interface FoodMonthlyTrendPoint {
  month: string
  amount: string
}
export interface FoodWorkspace {
  month: string
  currency: 'VND'
  page: number
  totalCount: number
  hasMore: boolean
  expenses: FoodExpense[]
  summary: Omit<ExpenseHomeSummary, 'month' | 'currency'> & {
    breakfastTotal: string
    dinnerTotal: string
    groceriesTotal?: string
    categories?: FoodCategoryTotal[]
    dailyTrend?: FoodTrendPoint[]
    monthlyTrend?: FoodMonthlyTrendPoint[]
  }
}
export class FoodApiError extends Error {
  readonly code: string
  constructor(code: string) {
    super('Family food unavailable')
    this.code = code
  }
}
async function request(path: string, init: RequestInit = {}) {
  const r = await fetch('/api/expenses/family-food' + path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (!r.ok) {
    let code = 'FOOD_UNAVAILABLE'
    try {
      const b = await r.json()
      if (typeof b?.error?.code === 'string') code = b.error.code
    } catch {}
    throw new FoodApiError(code)
  }
  return r.status === 204 ? null : ((await r.json()) as unknown)
}
function object(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
const money = (v: unknown): v is string =>
  typeof v === 'string' && /^(0|[1-9]\d*)$/.test(v)
const date = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^20\d\d-\d{2}-\d{2}$|^21\d\d-\d{2}-\d{2}$/.test(v) &&
  new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v
function parseExpense(v: unknown): FoodExpense {
  if (!object(v) || typeof v.id !== 'string' || !date(v.mealDate))
    throw new Error('Invalid food expense')
  if (v.category === 'GROCERIES') {
    if (
      v.mealType !== null ||
      !(v.note === null || typeof v.note === 'string') ||
      !money(v.amount) ||
      !money(v.total) ||
      v.amount !== v.total
    )
      throw new Error('Invalid grocery expense')
    return {
      id: v.id,
      mealDate: v.mealDate,
      mealType: null,
      category: 'GROCERIES',
      note: v.note as string | null,
      items: [{ name: 'Đi chợ / nguyên liệu', amount: v.amount }],
      total: v.total,
    }
  }
  if (
    typeof v.mealType !== 'string' ||
    !['BREAKFAST', 'DINNER'].includes(v.mealType) ||
    (v.category !== undefined && v.category !== v.mealType) ||
    !(v.note === null || typeof v.note === 'string') ||
    !Array.isArray(v.items) ||
    v.items.length < 1 ||
    v.items.length > 30 ||
    !money(v.total)
  )
    throw new Error('Invalid food expense')
  const items = v.items.map((i) => {
    if (
      !object(i) ||
      typeof i.name !== 'string' ||
      !i.name.trim() ||
      Array.from(i.name).length > 120 ||
      !money(i.amount) ||
      BigInt(i.amount) < 1n ||
      BigInt(i.amount) > 1000000000n
    )
      throw new Error('Invalid food item')
    return { name: i.name, amount: i.amount }
  })
  if (items.reduce((s, i) => s + BigInt(i.amount), 0n).toString() !== v.total)
    throw new Error('Invalid food total')
  return {
    id: v.id,
    mealDate: v.mealDate,
    mealType: v.mealType as FoodMealType,
    category: v.mealType as FoodMealType,
    note: v.note as string | null,
    items,
    total: v.total,
  }
}
export async function fetchFood(
  month: string,
  page: number,
  signal: AbortSignal,
): Promise<FoodWorkspace> {
  const b = await request(`?month=${encodeURIComponent(month)}&page=${page}`, {
    signal,
  })
  if (!object(b) || !object(b.familyFood))
    throw new Error('Invalid food workspace')
  const v = b.familyFood
  if (!object(v.summary)) throw new Error('Invalid food summary')
  const s = v.summary
  const groceriesTotal = money(s.groceriesTotal) ? s.groceriesTotal : '0'
  const categories = Array.isArray(s.categories)
    ? s.categories.map(parseCategoryTotal)
    : [
        { category: 'BREAKFAST' as const, amount: s.breakfastTotal as string },
        { category: 'DINNER' as const, amount: s.dinnerTotal as string },
        { category: 'GROCERIES' as const, amount: '0' },
      ]
  if (
    !object(s) ||
    !validExpenseHomeSummary({ ...s, month: v.month, currency: v.currency }) ||
    v.month !== month ||
    v.page !== page ||
    !Number.isSafeInteger(v.totalCount) ||
    !Array.isArray(v.expenses) ||
    v.expenses.length > 20 ||
    (v.totalCount as number) < v.expenses.length ||
    v.hasMore !== page * 20 < (v.totalCount as number) ||
    !money(s.breakfastTotal) ||
    !money(s.dinnerTotal) ||
    BigInt(s.breakfastTotal) + BigInt(s.dinnerTotal) +
      BigInt(groceriesTotal) !== BigInt(s.currentTotal as string) ||
    (Array.isArray(s.categories) &&
      (s.categories.length !== 3 ||
        categories.reduce((sum, c) => sum + BigInt(c.amount), 0n) !==
          BigInt(s.currentTotal as string)))
  )
    throw new Error('Invalid food summary')
  const expenses = v.expenses.map(parseExpense)
  if (expenses.some((e) => e.mealDate.slice(0, 7) !== month))
    throw new Error('Invalid food month')
  return {
    month,
    currency: 'VND',
    page,
    totalCount: v.totalCount as number,
    hasMore: v.hasMore as boolean,
    expenses,
    summary: {
      currentTotal: s.currentTotal as string,
      previousMonth: s.previousMonth as string,
      previousTotal: s.previousTotal as string,
      differenceAmount: s.differenceAmount as string,
      percentageChange: s.percentageChange as number | null,
      breakfastTotal: s.breakfastTotal,
      dinnerTotal: s.dinnerTotal,
      ...(money(s.groceriesTotal)
        ? { groceriesTotal: groceriesTotal }
        : {}),
      ...(Array.isArray(s.categories) ? { categories } : {}),
      ...(Array.isArray(s.dailyTrend)
        ? { dailyTrend: s.dailyTrend.map(parseDailyTrend) }
        : {}),
      ...(Array.isArray(s.monthlyTrend)
        ? { monthlyTrend: s.monthlyTrend.map(parseMonthlyTrend) }
        : {}),
    },
  }
}
export async function fetchFoodSlot(
  mealDate: string,
  mealType: FoodMealType,
  signal: AbortSignal,
) {
  const b = await request(
    '/slot?' + new URLSearchParams({ mealDate, mealType }),
    { signal },
  )
  if (!object(b)) throw new Error('Invalid food slot')
  if (b.expense === null) return null
  const e = parseExpense(b.expense)
  if (e.mealDate !== mealDate || e.mealType !== mealType)
    throw new Error('Invalid food slot')
  return e
}
export async function prefillFood(
  mealDate: string,
  mealType: FoodMealType,
) {
  const b = await request(
    '/prefill?' + new URLSearchParams({ mealDate, mealType }),
  )
  if (
    !object(b) ||
    !Array.isArray(b.names) ||
    b.names.length > 30 ||
    !b.names.every(
      (n) => typeof n === 'string' && n.trim() && Array.from(n).length <= 120,
    )
  )
    throw new Error('Invalid food names')
  return b.names as string[]
}
export async function saveFood(id: string | null, input: FoodInput) {
  await request(id ? '/' + encodeURIComponent(id) : '', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(input),
  })
}

function parseCategoryTotal(v: unknown): FoodCategoryTotal {
  if (
    !object(v) ||
    !['BREAKFAST', 'DINNER', 'GROCERIES'].includes(String(v.category)) ||
    !money(v.amount)
  )
    throw new Error('Invalid food category total')
  return { category: v.category as FoodCategory, amount: v.amount }
}
function parseDailyTrend(v: unknown): FoodTrendPoint {
  if (!object(v) || !date(v.date) || !money(v.amount))
    throw new Error('Invalid food daily trend')
  return { date: v.date, amount: v.amount }
}
function parseMonthlyTrend(v: unknown): FoodMonthlyTrendPoint {
  if (!object(v) || typeof v.month !== 'string' || !/^20\d\d-(0[1-9]|1[0-2])$/.test(v.month) || !money(v.amount))
    throw new Error('Invalid food monthly trend')
  return { month: v.month, amount: v.amount }
}
export async function removeFood(id: string) {
  await request('/' + encodeURIComponent(id), { method: 'DELETE' })
}
