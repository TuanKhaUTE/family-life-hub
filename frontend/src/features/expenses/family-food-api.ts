import { validExpenseHomeSummary, type ExpenseHomeSummary } from './expense-api'
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
  if (
    !object(v) ||
    typeof v.id !== 'string' ||
    !date(v.mealDate) ||
    typeof v.mealType !== 'string' ||
    !['BREAKFAST', 'DINNER'].includes(v.mealType) ||
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
    mealType: v.mealType as FoodInput['mealType'],
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
  const v = b.familyFood,
    s = v.summary
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
    BigInt(s.breakfastTotal) + BigInt(s.dinnerTotal) !==
      BigInt(s.currentTotal as string)
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
    },
  }
}
export async function fetchFoodSlot(
  mealDate: string,
  mealType: FoodInput['mealType'],
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
  mealType: FoodInput['mealType'],
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
export async function removeFood(id: string) {
  await request('/' + encodeURIComponent(id), { method: 'DELETE' })
}
