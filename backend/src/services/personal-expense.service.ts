import { ApiError } from '../errors/api-error.js'
import type { SafeFamilyProfile } from './family-auth.service.js'
import { getFamilyDate } from '../time/family-calendar.js'
import { validDate } from './calendar.service.js'

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
export interface ExpenseCategoryTotal {
  category: ExpenseCategory
  amount: string
}
export interface ExpenseData {
  expenses: PersonalExpense[]
  totalCount: number
  currentTotal: string
  previousTotal: string
  categories: ExpenseCategoryTotal[]
}
export interface PersonalExpenseRepository {
  read(actorId: string, month: string, page: number): Promise<ExpenseData>
  mutate(
    actorId: string,
    id: string | null,
    input: PersonalExpenseInput | null,
    remove: boolean,
  ): Promise<void>
}
export class PersonalExpenseService {
  constructor(
    private readonly repository: PersonalExpenseRepository,
    private readonly clock = () => new Date(),
  ) {}
  async read(actor: SafeFamilyProfile, month?: unknown, page?: unknown) {
    allowed(actor)
    const selectedMonth =
      month === undefined
        ? getFamilyDate(this.clock()).slice(0, 7)
        : expenseMonth(month)
    const selectedPage = page === undefined ? 1 : expensePage(page)
    return this.run(async () => {
      const data = await this.repository.read(
        actor.id,
        selectedMonth,
        selectedPage,
      )
      return {
        month: selectedMonth,
        currency: 'VND' as const,
        page: selectedPage,
        totalCount: data.totalCount,
        hasMore: selectedPage * 20 < data.totalCount,
        expenses: data.expenses,
        summary: {
          currentTotal: data.currentTotal,
          previousTotal: data.previousTotal,
          previousMonth: previousExpenseMonth(selectedMonth),
          ...expenseComparison(data.currentTotal, data.previousTotal),
          categories: data.categories,
        },
      }
    })
  }
  async summary(actor: SafeFamilyProfile) {
    const view = await this.read(actor)
    const {
      currentTotal,
      previousTotal,
      previousMonth,
      differenceAmount,
      percentageChange,
    } = view.summary
    return {
      month: view.month,
      currency: view.currency,
      currentTotal,
      previousMonth,
      previousTotal,
      differenceAmount,
      percentageChange,
    }
  }
  async save(actor: SafeFamilyProfile, id: unknown, input: unknown) {
    allowed(actor)
    if (id !== null) expenseId(id)
    const data = normalizePersonalExpense(input, getFamilyDate(this.clock()))
    await this.run(() =>
      this.repository.mutate(actor.id, id as string | null, data, false),
    )
  }
  async remove(actor: SafeFamilyProfile, id: unknown) {
    allowed(actor)
    expenseId(id)
    await this.run(() => this.repository.mutate(actor.id, id, null, true))
  }
  private async run<T>(op: () => Promise<T>) {
    try {
      return await op()
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        503,
        'EXPENSE_UNAVAILABLE',
        'Personal expenses are temporarily unavailable',
      )
    }
  }
}
export function normalizePersonalExpense(
  value: unknown,
  today: string,
): PersonalExpenseInput {
  if (
    !object(value) ||
    Object.keys(value).some(
      (key) => !['amount', 'spentOn', 'category', 'note'].includes(key),
    )
  )
    invalid()
  if (
    !money(value.amount) ||
    value.amount.length > 10 ||
    BigInt(value.amount) < 1n ||
    BigInt(value.amount) > 1000000000n
  )
    invalid()
  if (!validDate(value.spentOn) || value.spentOn > today) invalid()
  if (!EXPENSE_CATEGORIES.includes(value.category as ExpenseCategory)) invalid()
  let note: string | null = null
  if (value.note != null) {
    if (
      typeof value.note !== 'string' ||
      Array.from(value.note.trim()).length > 1000
    )
      invalid()
    note = value.note.trim() || null
  }
  return {
    amount: value.amount,
    spentOn: value.spentOn,
    category: value.category as ExpenseCategory,
    note,
  }
}
export function expenseComparison(current: string, previous: string) {
  const difference = BigInt(current) - BigInt(previous),
    prior = BigInt(previous)
  let percentageChange: number | null = null
  if (prior > 0n) {
    // Currency arithmetic stays integral. Only the rounded, dimensionless ratio becomes a Number.
    const scaled =
      ((difference < 0n ? -difference : difference) * 1000n + prior / 2n) /
      prior
    if (scaled <= BigInt(Number.MAX_SAFE_INTEGER))
      percentageChange = ((difference < 0n ? -1 : 1) * Number(scaled)) / 10
  }
  return { differenceAmount: difference.toString(), percentageChange }
}
export function expenseMonth(v: unknown): string {
  if (typeof v !== 'string' || !/^(20\d\d|21\d\d)-(0[1-9]|1[0-2])$/.test(v))
    invalid()
  return v
}
function expensePage(v: unknown) {
  if (typeof v !== 'string' || !/^[1-9]\d{0,5}$/.test(v) || Number(v) > 100000)
    invalid()
  return Number(v)
}
export function previousExpenseMonth(month: string) {
  const date = new Date(month + '-01T12:00:00Z')
  date.setUTCMonth(date.getUTCMonth() - 1)
  return date.toISOString().slice(0, 7)
}
export function expenseId(v: unknown): asserts v is string {
  if (
    typeof v !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    )
  )
    invalid()
}
export function money(v: unknown): v is string {
  return typeof v === 'string' && /^(0|[1-9]\d*)$/.test(v)
}
function allowed(actor: SafeFamilyProfile) {
  if (!['PARENT', 'ADMIN', 'MEMBER'].includes(actor.role))
    throw new ApiError(
      403,
      'EXPENSE_FORBIDDEN',
      'Personal expense access is not permitted',
    )
}
function object(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
function invalid(): never {
  throw new ApiError(400, 'EXPENSE_INVALID', 'Invalid personal expense input')
}
