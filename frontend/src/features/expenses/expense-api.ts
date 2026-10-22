export const EXPENSE_CATEGORIES = [
  'FOOD',
  'TRANSPORT',
  'SHOPPING',
  'ENTERTAINMENT',
  'STUDY',
  'FITNESS',
  'BILLS',
  'OTHER',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]
export interface PersonalExpenseInput {
  amount: string
  spentOn: string
  category: ExpenseCategory
  note: string | null
}
export interface PersonalExpense extends PersonalExpenseInput {
  id: string
}
export interface ExpenseHomeSummary {
  month: string
  currency: 'VND'
  currentTotal: string
  previousMonth: string
  previousTotal: string
  differenceAmount: string
  percentageChange: number | null
}
export interface ExpenseSummary
  extends Omit<ExpenseHomeSummary, 'month' | 'currency'> {
  categories: { category: ExpenseCategory; amount: string }[]
}
export interface PersonalExpenseWorkspace {
  month: string
  currency: 'VND'
  page: number
  totalCount: number
  hasMore: boolean
  expenses: PersonalExpense[]
  summary: ExpenseSummary
}
export class ExpenseApiError extends Error {
  readonly code: string
  constructor(code: string) {
    super('Personal expenses unavailable')
    this.code = code
  }
}
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`/api/expenses/personal${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (!response.ok) {
    let code = 'EXPENSE_UNAVAILABLE'
    try {
      const b: unknown = await response.json()
      if (object(b) && object(b.error) && typeof b.error.code === 'string')
        code = b.error.code
    } catch {}
    throw new ExpenseApiError(code)
  }
  return response.status === 204 ? null : ((await response.json()) as unknown)
}
export async function fetchPersonalExpenses(
  month: string,
  page: number,
  signal: AbortSignal,
): Promise<PersonalExpenseWorkspace> {
  const b = await request(`?month=${encodeURIComponent(month)}&page=${page}`, {
    signal,
  })
  if (!object(b) || !object(b.personalExpenses)) invalid()
  const v = b.personalExpenses,
    s = v.summary
  if (
    !object(s) ||
    !validExpenseHomeSummary({ ...s, month: v.month, currency: v.currency }) ||
    !Array.isArray(s.categories) ||
    s.categories.length > 8 ||
    !Array.isArray(v.expenses) ||
    v.expenses.length > 20 ||
    !Number.isSafeInteger(v.page) ||
    (v.page as number) < 1 ||
    !Number.isSafeInteger(v.totalCount) ||
    (v.totalCount as number) < v.expenses.length ||
    v.hasMore !== (v.page as number) * 20 < (v.totalCount as number)
  )
    invalid()
  const expenses = v.expenses.map((row) => {
    if (
      !object(row) ||
      typeof row.id !== 'string' ||
      !unsignedMoney(row.amount) ||
      row.amount === '0' ||
      BigInt(row.amount) > 1000000000n ||
      !date(row.spentOn) ||
      row.spentOn.slice(0, 7) !== v.month ||
      !EXPENSE_CATEGORIES.includes(row.category as ExpenseCategory) ||
      !(row.note === null || typeof row.note === 'string')
    )
      invalid()
    return {
      id: row.id,
      amount: row.amount,
      spentOn: row.spentOn,
      category: row.category as ExpenseCategory,
      note: row.note as string | null,
    }
  })
  const categories = s.categories.map((row) => {
    if (
      !object(row) ||
      !EXPENSE_CATEGORIES.includes(row.category as ExpenseCategory) ||
      !unsignedMoney(row.amount) ||
      row.amount === '0'
    )
      invalid()
    return { category: row.category as ExpenseCategory, amount: row.amount }
  })
  if (
    new Set(categories.map((c) => c.category)).size !== categories.length ||
    categories.reduce((sum, c) => sum + BigInt(c.amount), 0n) !==
      BigInt(s.currentTotal as string)
  )
    invalid()
  return {
    month: v.month as string,
    currency: 'VND',
    page: v.page as number,
    totalCount: v.totalCount as number,
    hasMore: v.hasMore as boolean,
    expenses,
    summary: {
      currentTotal: s.currentTotal as string,
      previousMonth: s.previousMonth as string,
      previousTotal: s.previousTotal as string,
      differenceAmount: s.differenceAmount as string,
      percentageChange: s.percentageChange as number | null,
      categories,
    },
  }
}
export function validExpenseHomeSummary(v: unknown): v is ExpenseHomeSummary {
  if (
    !object(v) ||
    !month(v.month) ||
    v.currency !== 'VND' ||
    !month(v.previousMonth) ||
    !unsignedMoney(v.currentTotal) ||
    !unsignedMoney(v.previousTotal) ||
    typeof v.differenceAmount !== 'string' ||
    !/^-?(0|[1-9]\d*)$/.test(v.differenceAmount)
  )
    return false
  if (
    v.differenceAmount !==
    (BigInt(v.currentTotal) - BigInt(v.previousTotal)).toString()
  )
    return false
  if (v.previousTotal === '0') return v.percentageChange === null
  if (v.percentageChange === null) {
    const difference = BigInt(v.differenceAmount),
      previous = BigInt(v.previousTotal)
    return (
      ((difference < 0n ? -difference : difference) * 1000n + previous / 2n) /
        previous >
      BigInt(Number.MAX_SAFE_INTEGER)
    )
  }
  return (
    typeof v.percentageChange === 'number' &&
    Number.isFinite(v.percentageChange) &&
    Math.abs(v.percentageChange) <= Number.MAX_SAFE_INTEGER
  )
}
export async function savePersonalExpense(
  id: string | null,
  value: PersonalExpenseInput,
) {
  await request(id ? `/${encodeURIComponent(id)}` : '', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(value),
  })
}
export async function deletePersonalExpense(id: string) {
  await request(`/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
export function expenseError(error: unknown) {
  if (error instanceof ExpenseApiError) {
    if (error.code === 'EXPENSE_NOT_FOUND')
      return 'Khoản chi này không còn trong góc riêng của bạn. Bạn tải lại nhé.'
    if (error.code === 'EXPENSE_FORBIDDEN')
      return 'Chỉ chủ khoản chi mới xem và thay đổi được thông tin này.'
    if (error.code === 'EXPENSE_INVALID')
      return 'Bạn kiểm tra ngày, danh mục và số tiền nguyên đồng từ 1 đến 1.000.000.000 đ nhé.'
    if (error.code === 'UNAUTHENTICATED')
      return 'Phiên đăng nhập đã hết. Bạn tải lại trang để vào nhà nhé.'
  }
  return 'Chưa thể cập nhật chi tiêu. Bạn thử lại nhé.'
}
function object(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
function unsignedMoney(v: unknown): v is string {
  return typeof v === 'string' && /^(0|[1-9]\d*)$/.test(v)
}
function month(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
}
function date(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v))
  )
}
function invalid(): never {
  throw new ExpenseApiError('EXPENSE_UNAVAILABLE')
}
